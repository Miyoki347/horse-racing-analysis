import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import type { HorseWithHistory } from '@/types/upcoming'
import type { SimConditions } from '@/app/api/simulate/route'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const TRACK_CONDITION_LABEL = ['良', '稍重', '重', '不良']

async function fetchJockeyStats(horses: HorseWithHistory[]) {
  const prefixes = [...new Set(horses.map((h) => h.jockey_name).filter((n): n is string => !!n && n.length >= 2))]
  const { data: allJockeys } = await supabase.from('jockeys').select('id, name')
  if (!allJockeys) return {}

  const matched = prefixes
    .map((p) => ({ prefix: p, jockey: allJockeys.find((j) => j.name.startsWith(p)) }))
    .filter((m): m is { prefix: string; jockey: { id: string; name: string } } => !!m.jockey)

  if (!matched.length) return {}

  const { data: results } = await supabase
    .from('race_results')
    .select('jockey_id, finish_position')
    .in('jockey_id', matched.map((m) => m.jockey.id))

  const map: Record<string, { fullName: string; winRate: number; top3Rate: number }> = {}
  for (const m of matched) {
    const rows = results?.filter((r) => r.jockey_id === m.jockey.id) ?? []
    const wins = rows.filter((r) => r.finish_position === 1).length
    const top3 = rows.filter((r) => r.finish_position != null && r.finish_position <= 3).length
    map[m.prefix] = {
      fullName: m.jockey.name,
      winRate:  rows.length > 0 ? Math.round((wins / rows.length) * 100) : 0,
      top3Rate: rows.length > 0 ? Math.round((top3 / rows.length) * 100) : 0,
    }
  }
  return map
}

export async function POST(req: NextRequest) {
  const { horses, conditions }: { horses: HorseWithHistory[]; conditions: SimConditions } = await req.json()
  if (!horses?.length) return new Response('No data', { status: 400 })

  const jockeyStats = await fetchJockeyStats(horses)

  const ranked = [...horses].sort((a, b) => (b.avg_time_index ?? 0) - (a.avg_time_index ?? 0))

  const horseSummary = ranked.map((h, i) => {
    const jStat = h.jockey_name ? jockeyStats[h.jockey_name] : null
    const jInfo = jStat
      ? `騎手:${jStat.fullName}(勝率${jStat.winRate}%・複勝率${jStat.top3Rate}%)`
      : `騎手:${h.jockey_name ?? '不明'}`
    const indexInfo = h.avg_time_index != null
      ? `条件別平均指数:${h.avg_time_index.toFixed(1)} / 最高:${h.best_time_index?.toFixed(1) ?? '-'}`
      : '条件別データなし'
    const recent = h.recent_results.slice(0, 3)
      .map((r) => `${r.date.slice(5)} ${r.finish_position ?? '-'}着(${r.time_index?.toFixed(1) ?? '-'})`)
      .join(' ')
    return `${i + 1}位予測: ${h.horse_name}（${jInfo} / ${indexInfo}${recent ? ' / 直近:' + recent : ''}）`
  }).join('\n')

  const condLabel = TRACK_CONDITION_LABEL[conditions.track_condition ?? 0] ?? '良'

  const prompt = `
あなたはデータサイエンスに基づく競馬アナリストです。ギャンブル的な煽り文句は禁止です。

【シミュレーション条件】
${conditions.course} ${conditions.distance}m ${conditions.track_type} 馬場:${condLabel}

【条件別タイム指数による予測順位】
${horseSummary}

以下の形式で出力してください。[TOP3]ブロックは必ず最初に出力すること。

[TOP3]
1|馬名|選んだ根拠（20文字以内）
2|馬名|選んだ根拠（20文字以内）
3|馬名|選んだ根拠（20文字以内）
[/TOP3]

## 展開予測
コース・距離・馬場状態・出走馬の脚質傾向から展開を予測。先行有利か差し有利かを明確に。3〜5文。

## 注目馬
条件別タイム指数と騎手特性を根拠に有力馬を2〜3頭解説。3〜5文。

## リスク
この予測が外れる要因を3点、箇条書きで。
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
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } },
  )
}
