import { type NextRequest } from "next/server"
import { z } from "zod"
import { runDebate } from "@/lib/engine"

export const runtime = "nodejs"
export const maxDuration = 800

const BodySchema = z.object({
  proposal: z.string().min(1),
  selectedPersonas: z.array(z.string()).optional(),
  maxRounds: z.number().int().min(1).max(5).optional(),
  background: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Invalid body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {}
      }
      const ac = new AbortController()
      req.signal.addEventListener("abort", () => ac.abort())

      try {
        await runDebate({
          proposal: body.proposal,
          selectedPersonas: body.selectedPersonas,
          maxRounds: body.maxRounds,
          context: { background: body.background },
          signal: ac.signal,
          onEvent: send,
        })
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
