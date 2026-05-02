import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { HorseWithHistory } from '@/types/upcoming'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

type BetType = 'sanrentan' | 'sanrenpuku'

function buildPrompt(horses: HorseWithHistory[], type: BetType): string {
  const race = horses[0]
  const sorted = [...horses]
    .sort((a, b) => (b.avg_time_index ?? 0) - (a.avg_time_index ?? 0))

  const horseLines = sorted.map((h, i) => {
    const idx     = h.avg_time_index != null ? `指数:${h.avg_time_index.toFixed(1)}` : '指数:なし'
    const ml      = h.ml_score != null ? `複勝確率:${(h.ml_score * 100).toFixed(0)}%` : ''
    const recent  = h.recent_results.slice(0, 3)
      .map(r => `${r.finish_position ?? '-'}着(${r.time_index?.toFixed(1) ?? '-'})`)
      .join(' ')
    const flags   = [
      h.is_jockey_changed ? '乗替' : '',
      h.rest_weeks != null && h.rest_weeks >= 12 ? `休${h.rest_weeks}週` : '',
      h.horse_weight_change != null && Math.abs(h.horse_weight_change) >= 8
        ? `体重${h.horse_weight_change > 0 ? '+' : ''}${h.horse_weight_change}` : '',
    ].filter(Boolean).join('・')
    return `${i + 1}位: ${h.horse_name}（${idx}${ml ? ' / ' + ml : ''}${recent ? ' / 直近:' + recent : ''}${flags ? ' / ' + flags : ''}）`
  }).join('\n')

  if (type === 'sanrentan') {
    return `
あなたはデータサイエンスに基づく競馬アナリストです。ギャンブル的な煽り文句は禁止です。

【レース】${race.race_name} ${race.race_date} ${race.course} ${race.distance}m ${race.track_type}

【出走馬（タイム指数降順）】
${horseLines}

---
以下の形式で出力してください。[SANRENTAN]ブロックを最初に出力すること。

[SANRENTAN]
1|馬名|1着に選んだ根拠（30文字以内）
2|馬名|2着に選んだ根拠（30文字以内）
3|馬名|3着に選んだ根拠（30文字以内）
[/SANRENTAN]

## 3連単予想の根拠

### 1着: [馬名]
指数・複勝確率・直近成績・ローテーションを踏まえた詳細な根拠を3〜4文で説明する。

### 2着: [馬名]
同上。1着馬との力関係も言及する。

### 3着: [馬名]
同上。展開や脚質の観点も含める。

## リスク要因
この予想が外れる可能性がある要因を箇条書きで2〜3点。
`.trim()
  }

  return `
あなたはデータサイエンスに基づく競馬アナリストです。ギャンブル的な煽り文句は禁止です。

【レース】${race.race_name} ${race.race_date} ${race.course} ${race.distance}m ${race.track_type}

【出走馬（タイム指数降順）】
${horseLines}

---
以下の形式で出力してください。[SANRENPUKU]ブロックを最初に出力すること。

[SANRENPUKU]
馬名A|3着以内に入る根拠（30文字以内）
馬名B|3着以内に入る根拠（30文字以内）
馬名C|3着以内に入る根拠（30文字以内）
[/SANRENPUKU]

## 3連複予想の根拠

### [馬名A]
指数・複勝確率・直近成績を踏まえた詳細な根拠を3〜4文で説明する。

### [馬名B]
同上。

### [馬名C]
同上。展開や脚質の観点も含める。

## リスク要因
この予想が外れる可能性がある要因を箇条書きで2〜3点。
`.trim()
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  void (await params)
  const { horses, type }: { horses: HorseWithHistory[]; type: BetType } = await req.json()

  if (!horses?.length) return new Response('No horses data', { status: 400 })
  if (type !== 'sanrentan' && type !== 'sanrenpuku') return new Response('Invalid type', { status: 400 })

  const prompt  = buildPrompt(horses, type)
  const stream  = await model.generateContentStream(prompt)
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const chunk of stream.stream) {
          const text = chunk.text()
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } },
  )
}
