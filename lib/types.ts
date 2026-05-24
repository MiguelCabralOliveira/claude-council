export type Origin = "project" | "user" | `plugin:${string}`

export type Position = "FOR" | "AGAINST" | "CONDITIONAL"

export interface Persona {
  id: string
  label: string
  initials: string
  source: string
  file: string
  description: string
  origin: Origin
}

export interface DebateMessage {
  id: string
  personaId: string
  round: number
  position: Position
  content: string
  rebuttalTo: string | null
  timestamp: string
}

export interface Clash {
  personaA: string
  personaB: string
  topic: string
}

export interface Synthesis {
  agreements: string[]
  clashes: Clash[]
  synthesis: string
}

export interface Verdict {
  verdict: "GO" | "NO-GO" | "CONDITIONAL"
  synthesis: string
  conditions?: string[]
  nextSteps?: string[]
}

export type DebateEvent =
  | { type: "debate-init"; personas: Persona[]; proposal: string; maxRounds: number }
  | { type: "round-start"; round: number; label: string }
  | { type: "persona-thinking"; personaId: string; round: number }
  | { type: "persona-streaming"; personaId: string; round: number; chunk: string }
  | { type: "message"; message: DebateMessage }
  | { type: "facilitator-thinking"; label: string }
  | {
      type: "facilitator-note"
      round: number | "final"
      noteType: "synthesis" | "final_verdict"
      synthesis: string
      agreements?: string[]
      clashes?: Clash[]
      conditions?: string[]
      nextSteps?: string[]
      verdict?: string
    }
  | { type: "debate-complete"; totalMessages: number }
  | { type: "error"; message: string }

export interface DebateContext {
  /**
   * Optional free-form text injected as background into every persona's opening
   * prompt. Use it to ground the council in a specific company, project, or
   * domain. Leave empty for a generic debate.
   */
  background?: string
}
