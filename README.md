# Council

A debate, not a chat. Pick any Claude Code skills or commands as participants,
write a proposal, and watch them argue. A neutral facilitator finds the
real clashes, runs targeted rebuttals, and delivers a verdict.

## Vibe code alert

This is 99% vibe coded. It started as a Saturday detour from another project,
got an Electron shell, then a React rewrite, then an extraction into its own
repo, all in a single afternoon with an agent in the loop. There is no test
suite, no error budget, no roadmap. It works on my machine and is provided
here mostly as inspiration. Ask your LLM to bend it however you like.

Conceptually it borrows from Karpathy's [llm-council](https://github.com/karpathy/llm-council),
but the mechanics are different (see [Why this is different](#why-this-is-different) below).

## How it works

1. **Discovery** scans for shareable participants in:
   - `<cwd>/.claude/commands/*.md`
   - `<cwd>/.claude/skills/*/SKILL.md`
   - `~/.claude/commands/*.md`
   - `~/.claude/skills/*/SKILL.md`
   - `~/.claude/plugins/marketplaces/*/plugins/*/{commands,skills}/...`

2. **Opening round** — every selected participant answers the proposal in
   parallel using a structured format (Position / Case / Risks / Question).

3. **Facilitator synthesis** — a neutral pass identifies agreements, real
   clashes between pairs, and a one-paragraph synthesis.

4. **Rebuttal rounds** — each clash spawns a targeted back-and-forth.
   Positions can update. The debate stops early when clashes converge.

5. **Verdict** — if clashes remain at the round limit, the facilitator
   delivers GO / NO-GO / CONDITIONAL with conditions and next steps.

## Requirements

- Node 18+
- The `claude` CLI installed and authenticated (each participant runs as
  `claude --print`).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Architecture

The repo splits cleanly along three axes: **discovery** (find skills),
**orchestration** (run rounds), and **rendering** (stream the debate).

### Module map

```
lib/
  types.ts       Shared domain types (Persona, DebateMessage, DebateEvent…)
  discover.ts    Walks .claude/ in cwd + $HOME + every installed plugin
  prompts.ts     Pure template functions for the 4 prompt shapes
  claude.ts      Spawns `claude --print`, handles timeout/abort, ANSI strip
  engine.ts      Round loop, batching, convergence check. No prompts inline.
  utils.ts       cn() helper
app/api/
  personas/      GET → discovered participants
  debate/        POST → ReadableStream of SSE events from the engine
components/
  Composer       Proposal + optional background context, Convene/Stop
  Picker         Grouped, filtered, searchable participant list
  Transcript     Round headers, message blocks, facilitator blocks
  Prose          Tiny markdown-ish renderer (bold + paragraphs)
app/
  page.tsx       Glue: SSE reader → state → child components
```

### Discovery

Discovery is a depth-1 directory walk over five known roots, merged with a
"first occurrence wins" dedupe (project beats user beats plugin). Each entry
gets the absolute source dir on it, so the engine can later read the file from
disk regardless of where it came from. Frontmatter (`name`, `description`)
is parsed by reading just the first 4 KB of each file. No YAML parser; the
frontmatter we care about is flat key:value.

### Orchestration

`engine.ts` runs the debate as a series of awaited phases, emitting events
through a single `onEvent` callback. There is no event bus, no state machine,
no class. The flow is:

```
opening round (parallel, bounded concurrency)
  → synthesis (1 call, JSON out)
  → for r in 2..maxRounds while clashes:
      rebuttal round (parallel pairs, each side responds)
      → synthesis (re-check convergence)
  → final verdict if still split
```

Each participant invocation is a separate `claude --print` subprocess.
The prompt is written to a temp file and piped in (the original Electron
version had stdin buffer issues on some platforms; the file approach is
boring and works).

### Streaming

The API route doesn't use a library. It hands the engine an `onEvent`
callback that serializes each event as `data: {json}\n\n` into a
`ReadableStream` controller. The client reads `Response.body` directly,
splits on `\n\n`, parses, and dispatches into React state. ~25 lines on
each side; no SSE framework.

### Why the facilitator isn't a skill

Participants are skills because their job is **opinionated** — different
viewpoints are the whole point, and the user supplies them. The facilitator's
job is **mechanical**: read N opinionated responses, return structured JSON
about agreements, clashes (pairs), and a brief synthesis. Making it a swappable
skill would let any skill author break the JSON contract the engine depends on.
So its prompts live in `lib/prompts.ts` next to the code that parses their
output.

If you ever want to make it pluggable (e.g. a "harsh facilitator" vs a
"diplomatic facilitator"), the seam is `lib/prompts.ts` — swap the
`buildSynthesisPrompt` / `buildVerdictPrompt` body, keep the JSON shape.

### BYO participants

The repo ships **no** persona pack. Every participant is something already
on your disk. This is intentional: persona prompts are the most opinionated
part of any council pattern, and most people end up rewriting them anyway.
Easier to lean on the user's existing skill catalog.

## Why this is different

Karpathy's [llm-council](https://github.com/karpathy/llm-council) inspired
the pattern but the mechanics diverge:

| | llm-council | this |
|---|---|---|
| Diversity comes from | different **models** (GPT, Claude, Gemini, Grok) | different **skills/personas** (same model) |
| Rounds | single shot | multi-round with rebuttals |
| Cross-talk | anonymous peer ranking | targeted clash → back-and-forth |
| Final output | chairman LLM compiles | facilitator verdict with conditions/next-steps |
| Best for | "what's the best answer to this question?" | "does this decision survive scrutiny?" |

Neither is strictly better. llm-council is wisdom-of-crowds. This is
adversarial dialectic.

## What this does not do (yet)

- **History UI**: debates are not persisted server-side. Add `history/` writes
  to the engine if you want them; the directory is already gitignored.
- **Per-participant model selection**: every participant runs as `claude --print`.
  Allowing one to be a cheaper/faster model would be a natural extension.
- **Identity anonymization for the facilitator**: today the facilitator sees
  "CEO said X" and may weigh titles. Stripping names before the synthesis call
  would borrow Karpathy's anti-favoritism trick.
- **Authentication / multi-user**: this is a single-user dev tool, not a
  hosted service.
