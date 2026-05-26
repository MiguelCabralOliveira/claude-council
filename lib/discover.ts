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

function statIsFile(p: string): boolean {
  try { return fs.statSync(p).isFile() } catch { return false }
}

function statIsDirectory(p: string): boolean {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

function collectFlatCommands(dir: string, origin: Origin): Raw[] {
  return safeReaddir(dir)
    .filter(d => {
      if (!d.name.endsWith(".md") || d.name === SELF) return false
      if (d.isFile()) return true
      if (d.isSymbolicLink()) return statIsFile(path.join(dir, d.name))
      return false
    })
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

function collectSkillBundles(dir: string, origin: Origin): Raw[] {
  const out: Raw[] = []
  for (const d of safeReaddir(dir)) {
    const bundleDir = path.join(dir, d.name)
    if (!d.isDirectory() && !(d.isSymbolicLink() && statIsDirectory(bundleDir))) continue
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

const SKIP_DIRS = new Set([
  "node_modules", ".git", "Library", ".Trash", ".cache", ".npm", ".vscode",
  ".next", "dist", "build", ".claude",
])

function findOtherClaudeDirs(home: string, projectDir: string, maxDepth = 4): string[] {
  const found: string[] = []
  const seen = new Set<string>([
    path.join(home, ".claude"),
    path.join(projectDir, ".claude"),
  ])
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return
    for (const d of safeReaddir(dir)) {
      if (!d.isDirectory() || d.name.startsWith(".")) {
        if (d.isDirectory() && d.name === ".claude") {
          const full = path.join(dir, d.name)
          if (!seen.has(full)) { seen.add(full); found.push(full) }
        }
        continue
      }
      if (SKIP_DIRS.has(d.name)) continue
      walk(path.join(dir, d.name), depth + 1)
    }
  }
  walk(home, 1)
  return found
}

export function discoverPersonas(projectDir: string = process.cwd()): Persona[] {
  const home = os.homedir()
  const otherClaudeDirs = findOtherClaudeDirs(home, projectDir)
  const otherProjectEntries: Raw[] = []
  for (const claudeDir of otherClaudeDirs) {
    otherProjectEntries.push(...collectFlatCommands(path.join(claudeDir, "commands"), "other-project"))
    otherProjectEntries.push(...collectSkillBundles(path.join(claudeDir, "skills"), "other-project"))
  }

  const raws = [
    ...collectFlatCommands(path.join(projectDir, ".claude", "commands"), "project"),
    ...collectSkillBundles(path.join(projectDir, ".claude", "skills"), "project"),
    ...collectFlatCommands(path.join(home, ".claude", "commands"), "user"),
    ...collectSkillBundles(path.join(home, ".claude", "skills"), "user"),
    ...collectPluginEntries(home),
    ...otherProjectEntries,
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
