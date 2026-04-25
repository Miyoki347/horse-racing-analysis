import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import type { HorseWithHistory } from '@/types/upcoming'
import type { WeatherResult } from '@/lib/weather'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface JockeyStat {
  fullName: string
  total: number
  wins: number
  top3: number
  winRate: number
  top3Rate: number
}

async function fetchJockeyStats(horses: HorseWithHistory[]): Promise<Record<string, JockeyStat>> {
  // 騎手名プレフィックスで DB の jockeys テーブルを検索
  const prefixes = [...new Set(horses.map((h) => h.jockey_name).filter((n): n is string => !!n && n.length >= 2))]

  const { data: allJockeys } = await supabase.from('jockeys').select('id, name')
  if (!allJockeys) return {}

  // プレフィックスマッチ（例: "坂井" → "坂井瑠星"）
  const matched: { prefix: string; id: string; fullName: string }[] = []
  for (const prefix of prefixes) {
    const found = allJockeys.find((j) => j.name.startsWith(prefix))
    if (found) matched.push({ prefix, id: found.id, fullName: found.name })
  }
  if (matched.length === 0) return {}

  const jockeyIds = matched.map((m) => m.id)

  // 勝利数・3着以内数・総レース数を取得
  const { data: results } = await supabase
    .from('race_results')
    .select('jockey_id, finish_position')
    .in('jockey_id', jockeyIds)

  const statsMap: Record<string, JockeyStat> = {}
  for (const m of matched) {
    const rows = results?.filter((r) => r.jockey_id === m.id) ?? []
    const wins = rows.filter((r) => r.finish_position === 1).length
    const top3 = rows.filter((r) => r.finish_position != null && r.finish_position <= 3).length
    statsMap[m.prefix] = {
      fullName: m.fullName,
      total:    rows.length,
      wins,
      top3,
      winRate:  rows.length > 0 ? Math.round((wins / rows.length) * 100) : 0,
      top3Rate: rows.length > 0 ? Math.round((top3 / rows.length) * 100) : 0,
    }
  }
  return statsMap
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  void (await params)
  const { horses, weather }: { horses: HorseWithHistory[]; weather?: WeatherResult | null } = await req.json()

  if (!horses || horses.length === 0) {
    return new Response('No horses data', { status: 400 })
  }

  const race = horses[0]
  const jockeyStats = await fetchJockeyStats(horses)

  // データあり馬（タイム指数で降順）
  const withData = [...horses]
    .filter((h) => h.avg_time_index != null)
    .sort((a, b) => (b.avg_time_index ?? 0) - (a.avg_time_index ?? 0))

  // データなし馬
  const noData = horses.filter((h) => h.avg_time_index == null)

  const buildHorseLine = (h: HorseWithHistory, rank?: number) => {
    const prefix = rank != null ? `${rank}位(指数): ` : '・'
    const jStat = h.jockey_name ? jockeyStats[h.jockey_name] : null
    const jInfo = jStat
      ? `騎手:${jStat.fullName}(勝率${jStat.winRate}%・複勝率${jStat.top3Rate}%)`
      : `騎手:${h.jockey_name ?? '不明'}`
    const indexInfo = h.avg_time_index != null
      ? `平均指数:${h.avg_time_index.toFixed(1)} / 最高:${h.best_time_index?.toFixed(1) ?? '-'}`
      : 'タイム指数データなし'
    const recent = h.recent_results.slice(0, 3)
      .map((r) => `${r.date.slice(5)} ${r.finish_position ?? '-'}着(${r.time_index?.toFixed(1) ?? '-'})`)
      .join(' ')
    const hw = h.horse_weight ? `馬体重:${h.horse_weight}kg(${h.horse_weight_change != null ? (h.horse_weight_change > 0 ? '+' : '') + h.horse_weight_change : '±0'})` : ''
    return `${prefix}${h.horse_name}（${jInfo} / ${indexInfo}${recent ? ' / 直近:' + recent : ''}${hw ? ' / ' + hw : ''}）`
  }

  const dataSection = withData.length > 0
    ? withData.map((h, i) => buildHorseLine(h, i + 1)).join('\n')
    : '（なし）'

  const noDataSection = noData.length > 0
    ? noData.map((h) => buildHorseLine(h)).join('\n')
    : ''

  const weatherSection = weather
    ? `【天気予報・馬場推定】
当日: ${weather.raceDay.label} / 降水量 ${weather.raceDay.precipMm.toFixed(1)}mm / 気温 ${weather.raceDay.tempMin.toFixed(0)}〜${weather.raceDay.tempMax.toFixed(0)}℃ / 風速 ${weather.raceDay.windMax.toFixed(1)}m/s
前日: ${weather.prevDay ? `${weather.prevDay.label} / 降水量 ${weather.prevDay.precipMm.toFixed(1)}mm` : 'データなし'}
推定馬場: ${weather.trackEstimate}（${weather.trackNote}）`
    : ''

  const prompt = `
あなたはデータサイエンスに基づく競馬アナリストです。ギャンブル的な煽り文句は禁止です。

【レース】${race.race_name}（${race.grade ?? 'OP'}）${race.race_date} ${race.course} ${race.distance}m ${race.track_type}

${weatherSection}

【タイム指数データあり馬（指数降順）】
${dataSection}

${noDataSection ? `【タイム指数データなし馬（騎手特性・馬体重で評価すること）】\n${noDataSection}` : ''}

---
以下の形式で出力してください。[TOP3]ブロックは必ず最初に出力すること。

[TOP3]
1|馬名|選んだ根拠（20文字以内）
2|馬名|選んだ根拠（20文字以内）
3|馬名|選んだ根拠（20文字以内）
[/TOP3]

## 展開予測
コース・距離・推定馬場状態・メンバー構成から展開を予測。推定馬場が結果に与える影響も言及。先行有利か差し有利かを明確に。3〜5文。

## 注目馬
指数・騎手特性・馬体重変化を根拠に上位候補を2〜3頭解説。データなし馬も騎手勝率や斤量から評価する。3〜5文。

## リスク
予測が外れる主な要因を箇条書きで3点。
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
