import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Origin, Persona } from "./types"

const SELF = "council.md"

function labelFromId(id: string): string {
  if (id.length <= 3 && /^[a-z]+$/.test(id)) return id.toUpperCase()
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---")) return {}
  const end = content.indexOf("\n---", 3)
  if (end === -1) return {}
  const out: Record<string, string> = {}
  for (const line of content.slice(3, end).split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return out
}

function readFrontmatter(filepath: string): Record<string, string> {
  try {
    const fd = fs.openSync(filepath, "r")
    const buf = Buffer.alloc(4096)
    const n = fs.readSync(fd, buf, 0, 4096, 0)
    fs.closeSync(fd)
    return parseFrontmatter(buf.slice(0, n).toString("utf-8"))
  } catch {
    return {}
  }
}

function safeReaddir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

type Raw = Omit<Persona, "initials">

function collectFlatCommands(dir: string, origin: Origin): Raw[] {
  return safeReaddir(dir)
    .filter(d => resolvedIs(dir, d, "file") && d.name.endsWith(".md") && d.name !== SELF)
    .map(d => {
      const id = d.name.replace(".md", "")
      const fm = readFrontmatter(path.join(dir, d.name))
      return {
        id,
        label: labelFromId(fm.name || id),
        description: fm.description || "",
        source: dir,
        file: d.name,
        origin,
      }
    })
}

function resolvedIs(dir: string, d: fs.Dirent, kind: "file" | "dir"): boolean {
  if (kind === "file" && d.isFile()) return true
  if (kind === "dir" && d.isDirectory()) return true
  if (!d.isSymbolicLink()) return false
  try {
    const s = fs.statSync(path.join(dir, d.name))
    return kind === "file" ? s.isFile() : s.isDirectory()
  } catch {
    return false
  }
}

function collectSkillBundles(dir: string, origin: Origin): Raw[] {
  const out: Raw[] = []
  for (const d of safeReaddir(dir)) {
    if (!resolvedIs(dir, d, "dir")) continue
    const bundleDir = path.join(dir, d.name)
    const skillPath = path.join(bundleDir, "SKILL.md")
    if (!fs.existsSync(skillPath)) continue
    const fm = readFrontmatter(skillPath)
    const id = fm.name || d.name
    out.push({
      id,
      label: labelFromId(id),
      description: fm.description || "",
      source: bundleDir,
      file: "SKILL.md",
      origin,
    })
  }
  return out
}

function collectPluginEntries(home: string): Raw[] {
  const out: Raw[] = []
  const marketRoot = path.join(home, ".claude", "plugins", "marketplaces")
  for (const market of safeReaddir(marketRoot).filter(d => d.isDirectory())) {
    const pluginsDir = path.join(marketRoot, market.name, "plugins")
    for (const plugin of safeReaddir(pluginsDir).filter(d => d.isDirectory())) {
      const pluginDir = path.join(pluginsDir, plugin.name)
      const tag: Origin = `plugin:${plugin.name}`
      out.push(...collectFlatCommands(path.join(pluginDir, "commands"), tag))
      out.push(...collectSkillBundles(path.join(pluginDir, "skills"), tag))
    }
  }
  return out
}

export function discoverPersonas(projectDir: string = process.cwd()): Persona[] {
  const home = os.homedir()
  const raws = [
    ...collectFlatCommands(path.join(projectDir, ".claude", "commands"), "project"),
    ...collectSkillBundles(path.join(projectDir, ".claude", "skills"), "project"),
    ...collectFlatCommands(path.join(home, ".claude", "commands"), "user"),
    ...collectSkillBundles(path.join(home, ".claude", "skills"), "user"),
    ...collectPluginEntries(home),
  ]

  const seen = new Set<string>()
  const out: Persona[] = []
  for (const raw of raws) {
    if (seen.has(raw.id)) continue
    seen.add(raw.id)
    out.push({
      ...raw,
      initials: raw.label
        .split(" ")
        .map(w => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export function readPersonaContent(persona: Persona): string {
  try {
    return fs.readFileSync(path.join(persona.source, persona.file), "utf-8")
  } catch {
    return `[File not found: ${persona.source}/${persona.file}]`
  }
}
