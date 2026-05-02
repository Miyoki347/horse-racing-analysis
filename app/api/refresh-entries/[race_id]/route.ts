import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  const { race_id } = await params
  const res = await fetch(`${FASTAPI}/refresh-entries/${race_id}`, { method: 'POST' })
  const json = await res.json()
  return NextResponse.json(json, { status: res.status })
}
