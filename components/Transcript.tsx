"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { DebateMessage, Persona, Position, Clash } from "@/lib/types"
import { Prose } from "./Prose"

export interface FacilitatorNote {
  round: number | "final"
  noteType: "synthesis" | "final_verdict"
  synthesis: string
  agreements?: string[]
  clashes?: Clash[]
  conditions?: string[]
  nextSteps?: string[]
  verdict?: string
}

export type TranscriptItem =
  | { kind: "round"; round: number; label: string }
  | { kind: "message"; message: DebateMessage }
  | { kind: "facilitator"; note: FacilitatorNote }

const POSITION_STYLES: Record<Position, string> = {
  FOR: "text-emerald-700 bg-emerald-50 border-emerald-200",
  AGAINST: "text-rose-700 bg-rose-50 border-rose-200",
  CONDITIONAL: "text-amber-700 bg-amber-50 border-amber-200",
}

interface Props {
  items: TranscriptItem[]
  personaMap: Record<string, Persona>
}

export function Transcript({ items, personaMap }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [items])

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center border border-dashed border-foreground/10 py-32">
        <p className="text-[13px] text-[var(--color-muted-foreground)]">
          Pick at least two participants, write a proposal, and start.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {items.map((item, i) => {
        if (item.kind === "round") {
          return (
            <div
              key={i}
              className="flex items-baseline gap-4 border-b border-foreground/10 pb-3 pt-4"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
                Round {item.round}
              </span>
              <span className="text-[15px] font-medium">{item.label}</span>
            </div>
          )
        }
        if (item.kind === "facilitator") {
          return <FacilitatorBlock key={i} note={item.note} personaMap={personaMap} />
        }
        return <MessageBlock key={i} message={item.message} personaMap={personaMap} />
      })}
      <div ref={endRef} />
    </div>
  )
}

function MessageBlock({
  message,
  personaMap,
}: {
  message: DebateMessage
  personaMap: Record<string, Persona>
}) {
  const persona = personaMap[message.personaId]
  return (
    <article className="grid grid-cols-[140px_1fr] gap-6">
      <div>
        <p className="text-[15px] font-medium leading-snug">
          {persona?.label || message.personaId}
        </p>
        {message.rebuttalTo && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            ↳ {personaMap[message.rebuttalTo]?.label || message.rebuttalTo}
          </p>
        )}
        <span
          className={cn(
            "mt-3 inline-block border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            POSITION_STYLES[message.position],
          )}
        >
          {message.position}
        </span>
      </div>
      <div className="text-[15px] leading-[1.65] text-foreground/85 [&_strong]:font-medium [&_strong]:text-foreground">
        <Prose text={message.content} />
      </div>
    </article>
  )
}

function FacilitatorBlock({
  note,
  personaMap,
}: {
  note: FacilitatorNote
  personaMap: Record<string, Persona>
}) {
  return (
    <article className="grid grid-cols-[140px_1fr] gap-6 border-l-2 border-foreground/40 pl-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
          Facilitator
        </p>
        <p className="mt-1 text-[13px] text-foreground/60">
          {note.noteType === "final_verdict" ? "Verdict" : `Synthesis · R${note.round}`}
        </p>
        {note.verdict && (
          <span className="mt-3 inline-block border border-foreground bg-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
            {note.verdict}
          </span>
        )}
      </div>
      <div className="space-y-4 text-[15px] leading-[1.65] text-foreground/85">
        {note.synthesis && <p>{note.synthesis}</p>}
        {note.agreements && note.agreements.length > 0 && (
          <NoteList label="Agreements" items={note.agreements} />
        )}
        {note.clashes && note.clashes.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Clashes
            </p>
            <ul className="space-y-1 text-[14px]">
              {note.clashes.map((c, i) => (
                <li key={i} className="text-foreground/75">
                  <span className="font-medium text-foreground">
                    {personaMap[c.personaA]?.label || c.personaA}
                  </span>{" "}
                  vs{" "}
                  <span className="font-medium text-foreground">
                    {personaMap[c.personaB]?.label || c.personaB}
                  </span>{" "}
                  - {c.topic}
                </li>
              ))}
            </ul>
          </div>
        )}
        {note.conditions && note.conditions.length > 0 && (
          <NoteList label="Conditions" items={note.conditions} />
        )}
        {note.nextSteps && note.nextSteps.length > 0 && (
          <NoteList label="Next steps" items={note.nextSteps} />
        )}
      </div>
    </article>
  )
}

function NoteList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <ul className="space-y-1 text-[14px]">
        {items.map((it, i) => (
          <li key={i} className="text-foreground/75">— {it}</li>
        ))}
      </ul>
    </div>
  )
}
