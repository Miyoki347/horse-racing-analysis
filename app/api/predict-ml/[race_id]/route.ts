import { NextRequest, NextResponse } from 'next/server'

const FASTAPI_URL = process.env.FASTAPI_URL ?? 'http://127.0.0.1:8000'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  const { race_id } = await params

  try {
    const res = await fetch(`${FASTAPI_URL}/predict/${race_id}/save`, {
      method: 'POST',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'FastAPI エラー' }))
      return NextResponse.json(
        { error: err.detail ?? 'FastAPI エラー' },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'この機能はローカル環境でのみ利用できます（uvicorn を起動してください）' },
      { status: 503 },
    )
  }
}
