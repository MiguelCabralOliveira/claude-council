"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { Origin, Persona } from "@/lib/types"

const FILTERS = ["all", "Project", "User", "Plugins"] as const
type Filter = (typeof FILTERS)[number]

function originLabel(origin: Origin): string {
  if (origin === "project") return "Project"
  if (origin === "user") return "User"
  return origin.replace("plugin:", "")
}

function originGroup(origin: Origin): "Project" | "User" | "Plugins" {
  if (origin === "project") return "Project"
  if (origin === "user") return "User"
  return "Plugins"
}

interface Props {
  personas: Persona[]
  selected: Set<string>
  onToggle: (id: string) => void
  disabled?: boolean
}

export function Picker({ personas, selected, onToggle, disabled }: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const grouped = useMemo(() => {
    const groups: Record<"Project" | "User" | "Plugins", Persona[]> = {
      Project: [],
      User: [],
      Plugins: [],
    }
    const q = search.trim().toLowerCase()
    for (const p of personas) {
      const group = originGroup(p.origin)
      if (filter !== "all" && filter !== group) continue
      if (q && !p.label.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
        continue
      }
      groups[group].push(p)
    }
    return groups
  }, [personas, filter, search])

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
          Participants
        </p>
        <div className="flex gap-3 font-mono text-[10px] uppercase tracking-wider">
          {FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "border-b border-transparent pb-0.5 transition-colors",
                filter === f
                  ? "border-foreground text-foreground"
                  : "text-[var(--color-muted-foreground)] hover:text-foreground/70",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter by name or description"
        className="mb-5 w-full border-0 border-b border-foreground/10 bg-transparent pb-2 text-[13px] placeholder:text-foreground/30 focus:border-foreground/30 focus:outline-none"
      />

      <div className="space-y-6">
        {(Object.entries(grouped) as ["Project" | "User" | "Plugins", Persona[]][]).map(
          ([group, items]) =>
            items.length === 0 ? null : (
              <div key={group}>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  {group} <span className="text-foreground/30">· {items.length}</span>
                </p>
                <ul className="space-y-1">
                  {items.map(p => {
                    const active = selected.has(p.id)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onToggle(p.id)}
                          disabled={disabled}
                          className={cn(
                            "group flex w-full items-baseline gap-3 border-l-2 py-2 pl-3 pr-1 text-left transition-colors",
                            active
                              ? "border-foreground bg-foreground/[0.03]"
                              : "border-transparent hover:border-foreground/20",
                            disabled && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[14px]",
                              active ? "text-foreground" : "text-foreground/60",
                            )}
                          >
                            {p.label}
                          </span>
                          {p.origin !== "project" && p.origin !== "user" && (
                            <span className="font-mono text-[9px] uppercase tracking-wider text-foreground/30">
                              {originLabel(p.origin)}
                            </span>
                          )}
                          {p.description && (
                            <span className="ml-auto max-w-[55%] truncate text-[11px] text-[var(--color-muted-foreground)]">
                              {p.description}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ),
        )}
      </div>
    </section>
  )
}
