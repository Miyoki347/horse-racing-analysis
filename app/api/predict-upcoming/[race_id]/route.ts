import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { HorseWithHistory } from '@/types/upcoming'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  const { race_id } = await params
  const { horses }: { horses: HorseWithHistory[] } = await req.json()

  if (!horses || horses.length === 0) {
    return new Response('No horses data', { status: 400 })
  }

  const race = horses[0]

  // 予測スコア順に並べてサマリー作成
  const ranked = [...horses]
    .filter((h) => h.avg_time_index != null)
    .sort((a, b) => (b.avg_time_index ?? 0) - (a.avg_time_index ?? 0))
    .slice(0, 5)

  const horseSummary = ranked.map((h, i) => {
    const recentStr = h.recent_results.slice(0, 3)
      .map((r) => `${r.date.slice(5)} ${r.finish_position ?? '-'}着(指数${r.time_index?.toFixed(1) ?? '-'})`)
      .join(' / ')
    return `${i + 1}位予測: ${h.horse_name}（騎手:${h.jockey_name ?? '-'} / 平均指数:${h.avg_time_index!.toFixed(1)} / 最高:${h.best_time_index?.toFixed(1) ?? '-'} / 直近: ${recentStr}）`
  }).join('\n')

  const noDataHorses = horses
    .filter((h) => h.avg_time_index == null)
    .map((h) => h.horse_name)
    .join('、')

  void race_id

  const prompt = `
あなたはデータサイエンスに基づく競馬アナリストです。ギャンブル的な煽り文句は禁止です。

【出走予定レース】${race.race_name}（${race.grade ?? 'OP'}）${race.race_date} ${race.course} ${race.distance}m ${race.track_type}

【過去タイム指数による予測上位5頭（降順）】
${horseSummary}
${noDataHorses ? `\n【データ不足馬（評価外）】${noDataHorses}` : ''}

以下の3ブロックのみ、各3〜5文で簡潔に出力してください。

## 展開予測
コース特性・距離・出走メンバーの脚質から展開を予測する。先行有利か差し有利かを明確に。

## 注目馬
過去タイム指数と安定性を根拠に、上位争いが期待される馬を2〜3頭解説する。

## リスク
予測が外れる要因（データ不足馬の台頭・展開変化・馬場など）を箇条書きで列挙する。
`.trim()

  const stream = await model.generateContentStream(prompt)
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
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    },
  )
}
