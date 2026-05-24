import { NextResponse } from "next/server"
import { discoverPersonas } from "@/lib/discover"

export const runtime = "nodejs"

export async function GET() {
  const personas = discoverPersonas(process.cwd())
  return NextResponse.json({ personas })
}
