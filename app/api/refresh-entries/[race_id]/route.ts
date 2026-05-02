import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.FASTAPI_URL ?? 'http://localhost:8000'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  const { race_id } = await params
  let res: Response
  try {
    res = await fetch(`${FASTAPI}/refresh-entries/${race_id}`, { method: 'POST' })
  } catch {
    return NextResponse.json({ detail: 'FastAPI サーバーに接続できません (localhost:8000)' }, { status: 503 })
  }
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return NextResponse.json({ detail: text || `FastAPI error (${res.status})` }, { status: res.status })
  }
  return NextResponse.json(json, { status: res.status })
}
