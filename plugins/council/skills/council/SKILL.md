---
name: council
description: Run a multi-participant debate inside Claude Code. The user names a proposal and a list of participants (CEO, CTO, head-of-design, etc.) and this skill spawns one subagent per participant — each impersonating that skill or command — collects their opening positions, runs a facilitator pass to find real clashes, runs rebuttal rounds, and delivers a verdict. Use when the user says "council", "call the council", "debate this with X, Y, Z", "run a council on …", or asks multiple personas to argue a decision.
---

# Council — adversarial debate via subagents

You orchestrate a structured debate between Claude Code skills and commands acting as personas. The user supplies the proposal and the participant list. You do the rest.

## Inputs you need

- **Proposal**: one sentence the participants will react to.
- **Background** (optional): a short paragraph of context.
- **Participants**: 2+ skill/command names (e.g. `ceo`, `cto`, `head-of-design`). Ask the user if missing.

If anything is missing, ask once with `AskUserQuestion`, then proceed.

## Step 1 — Locate each participant

For each name, find the persona definition by checking these paths in order and stopping at the first hit:

1. `<cwd>/.claude/commands/<name>.md`
2. `<cwd>/.claude/skills/<name>/SKILL.md`
3. `~/.claude/commands/<name>.md`
4. `~/.claude/skills/<name>/SKILL.md`
5. `~/.claude/plugins/marketplaces/*/plugins/*/commands/<name>.md`
6. `~/.claude/plugins/marketplaces/*/plugins/*/skills/<name>/SKILL.md`

Read the file with the Read tool. The frontmatter `description` plus the body is the persona's instruction set.

If a name resolves to nothing, tell the user and skip it. Don't fabricate a persona.

## Step 2 — Opening round (parallel)

Spawn one subagent per participant **in parallel** (single message, multiple Agent tool calls). Use `subagent_type: "general-purpose"` for each.

The prompt for each subagent must include:

1. The participant's full persona file content (frontmatter stripped or kept — doesn't matter, the agent will read it as instructions).
2. The proposal and background.
3. A required response shape:

```
Position: <one sentence>
Case: <2-4 bullets supporting the position>
Risks: <2-3 bullets — what could go wrong>
Question: <one sharp question for the other participants>
```

Collect every response. Show each one to the user verbatim, labeled by participant name.

## Step 3 — Facilitator synthesis

Spawn a single `general-purpose` subagent as the **facilitator**. Give it all opening responses plus this instruction:

> You are a neutral facilitator. Read the responses and output JSON only:
> ```json
> {
>   "agreements": ["..."],
>   "clashes": [{"a": "<name>", "b": "<name>", "topic": "<one line>"}],
>   "synthesis": "<one short paragraph>"
> }
> ```

Parse the JSON. Show the synthesis and the clash list to the user.

If `clashes` is empty, skip to Step 5.

## Step 4 — Rebuttal rounds

For each clash, spawn two subagents in parallel — one as participant A, one as B — each given:

- Their original persona file
- The proposal and background
- Their own opening response
- The other participant's opening response
- Instruction: "Respond directly to <other>'s position on <topic>. Update your position if warranted. Same response shape as before."

After all clashes are rebutted, re-run the facilitator pass on the updated positions. If clashes remain and you haven't hit round 3, loop. Otherwise continue.

Default `maxRounds = 3`.

## Step 5 — Verdict

If clashes converged, output a short summary: what was decided, where everyone landed.

If clashes remain at round limit, spawn the facilitator once more with this instruction:

> Deliver a verdict: **GO**, **NO-GO**, or **CONDITIONAL**. If CONDITIONAL, list the conditions and next steps. Be specific.

Show the verdict to the user.

## Output conventions

- Stream progress as you go — don't go silent for minutes while subagents run.
- Label every participant message with their name in bold.
- Round headers: `## Round 1 — Opening`, `## Round 2 — Rebuttals`, etc.
- Keep your own narration minimal between rounds. The participants do the talking.

## When NOT to use this skill

- Single-perspective questions ("what does the CTO think about X?") — just adopt that one persona directly, no orchestration needed.
- Tasks that require running real tools (deploying, editing code, etc.). Council is for *deliberation*, not execution. After a verdict, the user can ask you to act on it.
