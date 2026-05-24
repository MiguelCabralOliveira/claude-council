import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g

export interface CallOptions {
  cwd?: string
  timeoutMs?: number
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
}

/**
 * Invoke the `claude` CLI in print mode. The prompt is written to a temp file
 * and piped in to avoid stdin buffering issues across platforms.
 */
export function callClaude(prompt: string, options: CallOptions = {}): Promise<string> {
  const { cwd = process.cwd(), timeoutMs = 180_000, signal, onChunk } = options

  return new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `council-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
    )
    fs.writeFileSync(tmpFile, prompt, "utf-8")

    const cmd =
      process.platform === "win32"
        ? `type "${tmpFile.replace(/\//g, "\\")}" | claude --print`
        : `cat "${tmpFile}" | claude --print`

    const proc = spawn(cmd, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let output = ""
    let stderr = ""
    let killed = false

    const cleanup = () => {
      try { fs.unlinkSync(tmpFile) } catch {}
    }

    const onAbort = () => {
      killed = true
      try { proc.kill() } catch {}
    }
    signal?.addEventListener("abort", onAbort)

    const timer = setTimeout(() => {
      killed = true
      try { proc.kill() } catch {}
      cleanup()
      resolve(`[Response timed out after ${timeoutMs / 1000}s]`)
    }, timeoutMs)

    proc.stdout.on("data", chunk => {
      const text = chunk.toString()
      output += text
      onChunk?.(text)
    })
    proc.stderr.on("data", chunk => {
      stderr += chunk.toString()
    })

    proc.on("close", code => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      cleanup()
      if (killed) {
        resolve("[Aborted]")
        return
      }
      if (code !== 0 && output.length === 0) {
        resolve(`[Claude exited with code ${code}${stderr ? `: ${stderr.slice(0, 200)}` : ""}]`)
        return
      }
      resolve(output.replace(ANSI_RE, "").trim())
    })

    proc.on("error", err => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      cleanup()
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`))
    })
  })
}
