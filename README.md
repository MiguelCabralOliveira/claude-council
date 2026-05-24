# Council

A debate, not a chat. Instead of asking one Claude session a question, you assemble a Council of Claude Code skills and commands, each acting as a participant with its own viewpoint, and watch them argue. A neutral facilitator finds the real disagreements, runs targeted rebuttals, and delivers a verdict.

In a bit more detail, here is what happens when you submit a proposal:

1. **Stage 1: Opening round**. The proposal is given to every selected participant in parallel. Each one answers in a structured format (Position / Case / Risks / Question), and responses are streamed into the transcript as they arrive.
2. **Stage 2: Synthesis**. A neutral facilitator reads all responses, finds the real clashes between specific pairs of participants, and notes the points of agreement.
3. **Stage 3: Rebuttal rounds**. Each clash spawns a targeted back-and-forth. Positions can update. The debate stops early when clashes converge.
4. **Stage 4: Verdict**. If clashes remain at the round limit, the facilitator delivers GO / NO-GO / CONDITIONAL with conditions and next steps.

## Vibe Code Alert

This was 99% vibe coded as a Saturday hack — Electron shell, then React rewrite, then extracted into its own repo, all in one afternoon with an agent in the loop. No tests, no roadmap. Provided as is for inspiration. Code is ephemeral now, ask your LLM to bend it however you want.

Conceptually borrowed from Karpathy's [llm-council](https://github.com/karpathy/llm-council), but the mechanics are different: diversity comes from different **skills** (same model) rather than different models, and the format is adversarial dialectic over multiple rounds instead of single-shot wisdom-of-crowds.

## Two ways to use this

**(a) As a Claude Code plugin** — no web app, no install, just talk to Claude:

```
/plugin marketplace add MiguelCabralOliveira/claude-council
/plugin install council@claude-council
```

Then in any Claude Code session: *"call the council with ceo, cto, head-of-design on this proposal: …"* The skill spawns subagents in parallel, each impersonating the named skill, and runs the full debate loop in your terminal.

**(b) As the web app below** — same idea, but with a UI, streamed transcript, and a participant picker. Keep reading.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install and authenticate the Claude CLI

Each participant runs as a separate `claude --print` subprocess. Install the [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) and make sure `claude` is on your PATH and signed in.

### 3. Bring your own participants

The repo ships no persona pack. Participants are discovered from your existing Claude Code commands and skills in:

- `<cwd>/.claude/{commands,skills}/`
- `~/.claude/{commands,skills}/`
- `~/.claude/plugins/marketplaces/*/plugins/*/{commands,skills}/`

The `predev` hook also runs `scripts/sync-claude-extensions.sh`, which scans `$HOME` for any project-level `.claude/{commands,skills}` directories and symlinks each entry into your user-level dir, so commands defined in other repos show up here automatically.

## Running the Application

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Tech Stack

- **Frontend & API:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **LLM:** Anthropic Claude via the local `claude` CLI (one subprocess per participant)
- **Streaming:** Server-Sent Events over `ReadableStream`, no SSE framework
- **Discovery:** plain `fs` walks over `.claude/` directories
