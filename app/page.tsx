"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Composer } from "@/components/Composer"
import { Picker } from "@/components/Picker"
import {
  Transcript,
  type FacilitatorNote,
  type TranscriptItem,
} from "@/components/Transcript"
import type { DebateEvent, Persona } from "@/lib/types"

export default function CouncilPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [proposal, setProposal] = useState("")
  const [background, setBackground] = useState("")
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("")
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch("/api/personas")
      .then(r => r.json())
      .then(({ personas }: { personas: Persona[] }) => setPersonas(personas))
      .catch(() => setStatus("Failed to load participants"))
  }, [])

  const personaMap = useMemo(
    () => Object.fromEntries(personas.map(p => [p.id, p])) as Record<string, Persona>,
    [personas],
  )

  const toggle = useCallback(
    (id: string) => {
      if (running) return
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [running],
  )

  const handleEvent = useCallback(
    (ev: DebateEvent) => {
      switch (ev.type) {
        case "debate-init":
          setStatus(`${ev.personas.length} participants · max ${ev.maxRounds} rounds`)
          break
        case "round-start":
          setStatus(`Round ${ev.round}: ${ev.label}`)
          setTranscript(t => [...t, { kind: "round", round: ev.round, label: ev.label }])
          break
        case "persona-thinking":
          setStatus(`${personaMap[ev.personaId]?.label || ev.personaId} thinking…`)
          break
        case "message":
          setTranscript(t => [...t, { kind: "message", message: ev.message }])
          break
        case "facilitator-thinking":
          setStatus(`Facilitator: ${ev.label}`)
          break
        case "facilitator-note": {
          const note: FacilitatorNote = {
            round: ev.round,
            noteType: ev.noteType,
            synthesis: ev.synthesis,
            agreements: ev.agreements,
            clashes: ev.clashes,
            conditions: ev.conditions,
            nextSteps: ev.nextSteps,
            verdict: ev.verdict,
          }
          setTranscript(t => [...t, { kind: "facilitator", note }])
          break
        }
        case "debate-complete":
          setStatus(`Complete · ${ev.totalMessages} messages`)
          break
        case "error":
          setStatus(`Error: ${ev.message}`)
          break
      }
    },
    [personaMap],
  )

  const start = useCallback(async () => {
    if (!proposal.trim() || selected.size < 2 || running) return
    setRunning(true)
    setStatus("Starting…")
    setTranscript([])

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal: proposal.trim(),
          selectedPersonas: Array.from(selected),
          maxRounds: 3,
          background: background.trim() || undefined,
        }),
        signal: ac.signal,
      })
      if (!res.ok || !res.body) {
        setStatus(`Error: ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          if (!chunk.startsWith("data:")) continue
          try {
            handleEvent(JSON.parse(chunk.slice(5).trim()))
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStatus("Error: " + (err as Error).message)
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [proposal, background, selected, running, handleEvent])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setRunning(false)
    setStatus("Stopped")
  }, [])

  const canStart = !running && proposal.trim().length > 0 && selected.size >= 2

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1400px] px-8 py-12">
        <header className="mb-12 flex items-baseline justify-between border-b border-foreground/10 pb-6">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
              Council
            </p>
            <h1 className="mt-2 text-4xl font-light tracking-tight">A debate, not a chat</h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
              Status
            </p>
            <p className="mt-1 font-mono text-xs text-foreground/70">{status || "Idle"}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[380px_1fr]">
          <aside className="space-y-10">
            <Composer
              proposal={proposal}
              onProposalChange={setProposal}
              background={background}
              onBackgroundChange={setBackground}
              selectedCount={selected.size}
              totalCount={personas.length}
              canStart={canStart}
              running={running}
              onStart={start}
              onStop={stop}
            />
            <Picker
              personas={personas}
              selected={selected}
              onToggle={toggle}
              disabled={running}
            />
          </aside>

          <main className="min-h-[60vh]">
            <Transcript items={transcript} personaMap={personaMap} />
          </main>
        </div>
      </div>
    </div>
  )
}
