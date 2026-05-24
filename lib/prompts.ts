import type { DebateMessage, Persona } from "./types"

interface OpeningArgs {
  persona: Persona
  personaContent: string
  proposal: string
  background?: string
}

export function buildOpeningPrompt({
  persona,
  personaContent,
  proposal,
  background,
}: OpeningArgs): string {
  const bg = background?.trim()
    ? `\n\n## Background\n${background.trim()}\n`
    : ""
  return `You are acting as: ${persona.label}.
${bg}
## Your Role & Concerns
${personaContent}

## The Proposal
${proposal}

## Your Task
Give your honest, opinionated take. Use this EXACT format:

**Position:** FOR or AGAINST or CONDITIONAL

**Your case:** 4-6 sentences. Your strongest argument grounded in your domain. Reference specific constraints and realities from the context above. No generic advice.

**Biggest risk if we DO this:** One concrete, specific risk from your domain.

**Biggest risk if we DON'T:** One concrete risk of staying the course.

**Key question:** One specific question only your domain would ask.

Be direct. No hedging. If this conflicts with another participant's likely priorities, say so and explain why yours matters more right now.`
}

interface RebuttalArgs {
  persona: Persona
  myMessage: DebateMessage
  theirMessage: DebateMessage
  theirPersona: Persona
  background?: string
}

export function buildRebuttalPrompt({
  persona,
  myMessage,
  theirMessage,
  theirPersona,
  background,
}: RebuttalArgs): string {
  const bg = background?.trim()
    ? `\n\n## Background (brief)\n${background.trim()}\n`
    : ""
  return `You are acting as: ${persona.label}.
${bg}
## Your Original Position (Round 1)
${myMessage.content}

## The Challenge From ${theirPersona.label}
${theirMessage.content}

## Your Task
Respond DIRECTLY to ${theirPersona.label}'s argument. Address their specific claims. You may:
1. **Hold your position** - explain why their concern doesn't outweigh yours
2. **Concede partially** - acknowledge their point but add conditions
3. **Concede fully** - they convinced you, explain what changed

Use this EXACT format:

**Updated Position:** FOR or AGAINST or CONDITIONAL

**Rebuttal:** 3-5 sentences directly addressing their specific claims. Name what they said and why they're right or wrong.

**Condition for agreement:** What would need to be true for you to fully agree? (or "N/A" if you concede fully)

Be direct. This is a real debate, not a polite suggestion.`
}

interface SynthesisArgs {
  proposal: string
  round: number
  personas: Persona[]
  messages: DebateMessage[]
}

export function buildSynthesisPrompt({
  proposal,
  round,
  personas,
  messages,
}: SynthesisArgs): string {
  const roundMessages = messages.filter(m => m.round === round)
  const summaries = roundMessages
    .map(m => {
      const persona = personas.find(p => p.id === m.personaId)
      const trunc = m.content.length > 800 ? m.content.slice(0, 800) + "..." : m.content
      return `### ${persona?.label || m.personaId} - ${m.position}\n${trunc}`
    })
    .join("\n\n---\n\n")

  return `You are a neutral facilitator analyzing a multi-agent debate.

## The Proposal
${proposal}

## Round ${round} Positions
${summaries}

## Your Task
Analyze the positions. Respond with ONLY valid JSON (no markdown fences, no explanation):

{
  "agreements": ["specific point 1", "specific point 2"],
  "clashes": [
    {"personaA": "id-1", "personaB": "id-2", "topic": "what they disagree about"}
  ],
  "synthesis": "2-3 sentence overall synthesis of where the council stands"
}

Valid persona IDs: ${personas.map(p => p.id).join(", ")}
Rules:
- Max 3 clashes. Only include genuine, substantive disagreements.
- Agreements should be specific, not generic.
- If positions are converging, note that in the synthesis.`
}

interface VerdictArgs {
  proposal: string
  personas: Persona[]
  messages: DebateMessage[]
}

export function buildVerdictPrompt({
  proposal,
  personas,
  messages,
}: VerdictArgs): string {
  const timeline = messages
    .map(m => {
      const persona = personas.find(p => p.id === m.personaId)
      const brief = m.content.slice(0, 300).replace(/\n/g, " ")
      return `[R${m.round}] ${persona?.label}: ${m.position} - ${brief}`
    })
    .join("\n")

  return `You are a neutral facilitator delivering the final verdict of a council debate.

## The Proposal
${proposal}

## Debate Summary
${timeline}

## Your Task
Deliver a final verdict. Respond with ONLY valid JSON:

{
  "verdict": "GO",
  "synthesis": "3-5 sentence final synthesis",
  "conditions": ["condition if needed"],
  "nextSteps": ["actionable step 1", "step 2"]
}

verdict must be exactly one of: GO, NO-GO, CONDITIONAL
Be honest. If split, say CONDITIONAL.`
}
