"use client"

import { cn } from "@/lib/utils"

interface Props {
  proposal: string
  onProposalChange: (value: string) => void
  background: string
  onBackgroundChange: (value: string) => void
  selectedCount: number
  totalCount: number
  canStart: boolean
  running: boolean
  onStart: () => void
  onStop: () => void
}

export function Composer({
  proposal,
  onProposalChange,
  background,
  onBackgroundChange,
  selectedCount,
  totalCount,
  canStart,
  running,
  onStart,
  onStop,
}: Props) {
  return (
    <section>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
        The Proposal
      </p>
      <textarea
        value={proposal}
        onChange={e => onProposalChange(e.target.value)}
        disabled={running}
        placeholder="What should the council debate?"
        rows={5}
        className="w-full resize-y border-0 border-b border-foreground/15 bg-transparent pb-3 text-[17px] leading-relaxed text-foreground placeholder:text-foreground/30 focus:border-foreground/40 focus:outline-none"
      />

      <details className="mt-6 text-[12px] text-[var(--color-muted-foreground)]">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider hover:text-foreground/80">
          Background (optional)
        </summary>
        <textarea
          value={background}
          onChange={e => onBackgroundChange(e.target.value)}
          disabled={running}
          placeholder="Company, project, or domain context to ground every participant."
          rows={4}
          className="mt-3 w-full resize-y border-0 border-b border-foreground/10 bg-transparent pb-2 text-[13px] leading-relaxed text-foreground placeholder:text-foreground/25 focus:border-foreground/30 focus:outline-none"
        />
      </details>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className={cn(
            "border border-foreground bg-foreground px-5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85",
            "disabled:cursor-not-allowed disabled:border-foreground/20 disabled:bg-foreground/20 disabled:text-foreground/40",
          )}
        >
          Convene
        </button>
        {running && (
          <button
            type="button"
            onClick={onStop}
            className="border border-foreground/20 px-5 py-2 text-[13px] font-medium text-foreground/70 hover:border-foreground/40 hover:text-foreground"
          >
            Stop
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-[var(--color-muted-foreground)]">
          {selectedCount} / {totalCount}
        </span>
      </div>
    </section>
  )
}
