import { callClaude } from "./claude"
import { discoverPersonas, readPersonaContent } from "./discover"
import {
  buildOpeningPrompt,
  buildRebuttalPrompt,
  buildSynthesisPrompt,
  buildVerdictPrompt,
} from "./prompts"
import type {
  DebateContext,
  DebateEvent,
  DebateMessage,
  Persona,
  Position,
  Synthesis,
  Verdict,
} from "./types"

export interface RunOptions {
  proposal: string
  selectedPersonas?: string[]
  maxRounds?: number
  concurrency?: number
  timeoutMs?: number
  cwd?: string
  context?: DebateContext
  signal?: AbortSignal
  onEvent: (event: DebateEvent) => void
}

function parsePosition(text: string): Position {
  const m = text.match(/\*\*(?:Updated )?Position:\*\*\s*(FOR|AGAINST|CONDITIONAL)/i)
  return (m ? m[1].toUpperCase() : "CONDITIONAL") as Position
}

function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) as T } catch {}
  }
  const raw = text.match(/\{[\s\S]*\}/)
  if (raw) {
    try { return JSON.parse(raw[0]) as T } catch {}
  }
  return null
}

async function runBatch<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    out.push(...(await Promise.all(batch.map(fn => fn()))))
  }
  return out
}

export async function runDebate(opts: RunOptions): Promise<void> {
  const {
    proposal,
    selectedPersonas,
    maxRounds = 3,
    concurrency = 4,
    timeoutMs = 180_000,
    cwd = process.cwd(),
    context = {},
    signal,
    onEvent,
  } = opts

  const all = discoverPersonas(cwd)
  const personas =
    selectedPersonas?.length
      ? all.filter(p => selectedPersonas.includes(p.id))
      : all

  if (personas.length < 2) {
    onEvent({ type: "error", message: "Select at least two participants." })
    return
  }

  const messages: DebateMessage[] = []
  onEvent({ type: "debate-init", personas, proposal, maxRounds })

  const callPersona = async (
    persona: Persona,
    prompt: string,
    round: number,
    rebuttalTo: string | null,
  ): Promise<DebateMessage> => {
    onEvent({ type: "persona-thinking", personaId: persona.id, round })
    const output = await callClaude(prompt, {
      cwd,
      timeoutMs,
      signal,
      onChunk: chunk => {
        onEvent({ type: "persona-streaming", personaId: persona.id, round, chunk })
      },
    })
    const message: DebateMessage = {
      id: `${persona.id}-r${round}-${Date.now()}`,
      personaId: persona.id,
      round,
      position: parsePosition(output),
      content: output,
      rebuttalTo,
      timestamp: new Date().toISOString(),
    }
    messages.push(message)
    onEvent({ type: "message", message })
    return message
  }

  // ── Opening round ──────────────────────────────────────────────────
  onEvent({ type: "round-start", round: 1, label: "Opening Positions" })
  const round1 = await runBatch(
    personas.map(p => () =>
      callPersona(
        p,
        buildOpeningPrompt({
          persona: p,
          personaContent: readPersonaContent(p),
          proposal,
          background: context.background,
        }),
        1,
        null,
      ),
    ),
    concurrency,
  )
  if (signal?.aborted) return

  // ── First synthesis ────────────────────────────────────────────────
  onEvent({ type: "facilitator-thinking", label: "Analyzing positions..." })
  let synthesis = await runFacilitator(round1, proposal, personas, 1, {
    cwd,
    timeoutMs,
    signal,
  })
  onEvent({
    type: "facilitator-note",
    round: 1,
    noteType: "synthesis",
    ...synthesis,
  })

  let clashes = synthesis.clashes
  let prevMessages = round1

  // ── Rebuttal rounds ────────────────────────────────────────────────
  for (let round = 2; round <= maxRounds; round++) {
    if (signal?.aborted) return
    if (clashes.length === 0) break

    onEvent({ type: "round-start", round, label: `Rebuttals - Round ${round}` })

    const tasks: Array<() => Promise<DebateMessage>> = []
    for (const clash of clashes) {
      const pA = personas.find(p => p.id === clash.personaA)
      const pB = personas.find(p => p.id === clash.personaB)
      const mA = prevMessages.find(m => m.personaId === clash.personaA)
      const mB = prevMessages.find(m => m.personaId === clash.personaB)
      if (!pA || !pB || !mA || !mB) continue
      tasks.push(() =>
        callPersona(
          pA,
          buildRebuttalPrompt({
            persona: pA,
            myMessage: mA,
            theirMessage: mB,
            theirPersona: pB,
            background: context.background,
          }),
          round,
          pB.id,
        ),
      )
      tasks.push(() =>
        callPersona(
          pB,
          buildRebuttalPrompt({
            persona: pB,
            myMessage: mB,
            theirMessage: mA,
            theirPersona: pA,
            background: context.background,
          }),
          round,
          pA.id,
        ),
      )
    }
    const rebuttals = await runBatch(tasks, concurrency)
    if (signal?.aborted) return

    onEvent({ type: "facilitator-thinking", label: "Checking for convergence..." })
    synthesis = await runFacilitator(
      [...prevMessages, ...rebuttals],
      proposal,
      personas,
      round,
      { cwd, timeoutMs, signal },
    )
    onEvent({
      type: "facilitator-note",
      round,
      noteType: round === maxRounds ? "final_verdict" : "synthesis",
      ...synthesis,
    })

    clashes = synthesis.clashes
    prevMessages = [...prevMessages, ...rebuttals]
  }

  // ── Final verdict (if still split) ─────────────────────────────────
  if (clashes.length > 0 && !signal?.aborted) {
    onEvent({ type: "facilitator-thinking", label: "Delivering final verdict..." })
    const v = await runVerdict(messages, proposal, personas, { cwd, timeoutMs, signal })
    onEvent({
      type: "facilitator-note",
      round: "final",
      noteType: "final_verdict",
      synthesis: v.synthesis,
      verdict: v.verdict,
      conditions: v.conditions,
      nextSteps: v.nextSteps,
    })
  }

  onEvent({ type: "debate-complete", totalMessages: messages.length })
}

interface FacilitatorOpts {
  cwd: string
  timeoutMs: number
  signal: AbortSignal | undefined
}

async function runFacilitator(
  messages: DebateMessage[],
  proposal: string,
  personas: Persona[],
  round: number,
  opts: FacilitatorOpts,
): Promise<Synthesis> {
  const prompt = buildSynthesisPrompt({ proposal, round, personas, messages })
  const output = await callClaude(prompt, opts)
  return (
    extractJson<Synthesis>(output) ?? {
      agreements: [],
      clashes: [],
      synthesis: output,
    }
  )
}

async function runVerdict(
  messages: DebateMessage[],
  proposal: string,
  personas: Persona[],
  opts: FacilitatorOpts,
): Promise<Verdict> {
  const prompt = buildVerdictPrompt({ proposal, personas, messages })
  const output = await callClaude(prompt, opts)
  return (
    extractJson<Verdict>(output) ?? {
      verdict: "CONDITIONAL",
      synthesis: output,
      conditions: [],
      nextSteps: [],
    }
  )
}
