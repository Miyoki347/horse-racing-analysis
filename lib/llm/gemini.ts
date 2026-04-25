import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Race, RaceResult } from '@/types/race'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

export async function generateRaceAnalysis(
  race: Race,
  results: RaceResult[],
): Promise<ReadableStream<Uint8Array>> {
  const top5 = [...results]
    .sort((a, b) => (a.popularity ?? 99) - (b.popularity ?? 99))
    .slice(0, 5)

  const horseSummary = top5.map((r) => {
    const name     = r.horses?.name ?? '不明'
    const jockey   = r.jockeys?.display_name ?? r.jockeys?.name ?? '不明'
    const idx      = r.time_index?.toFixed(1) ?? '-'
    const last3f   = r.last_3f_time ?? '-'
    const pop      = r.popularity ?? '-'
    const odds     = r.odds ?? '-'
    return `・${name}（騎手:${jockey} / タイム指数:${idx} / 上がり3F:${last3f}秒 / 人気:${pop}番人気 / 単勝:${odds}倍）`
  }).join('\n')

  const condition = ['良', '稍重', '重', '不良'][race.track_condition] ?? '良'

  const prompt = `
あなたはデータサイエンスに基づく競馬アナリストです。ギャンブル的な煽り文句は禁止です。

【レース】${race.race_name}（${race.grade ?? 'OP'}）${race.date} ${race.course} ${race.distance}m ${race.track_type} 馬場:${condition}

【人気上位5頭】
${horseSummary}

以下の3ブロックのみ、各ブロック3〜5文で簡潔に出力してください。

## 展開予測
ペース・隊列・コース特性から展開を予測する。先行有利か差し有利かを明確に。

## 注目馬
タイム指数と上がり3Fを根拠に、上位争いが期待される馬を2〜3頭解説する。

## リスク
展開不一致・過剰人気・天候など、予測が外れる主な要因を箇条書きで列挙する。
`.trim()

  const stream = await model.generateContentStream(prompt)

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of stream.stream) {
        const text = chunk.text()
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })
}
