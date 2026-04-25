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
  courseWinRate: number | null
  courseTop3Rate: number | null
  courseRaceCount: number | null
}

function distBucket(distance: number): string {
  if (distance <= 1400) return 'short'
  if (distance <= 1800) return 'mile'
  if (distance <= 2200) return 'middle'
  return 'long'
}

async function fetchJockeyStats(
  horses: HorseWithHistory[],
  course: string,
  trackType: string,
  distance: number,
): Promise<Record<string, JockeyStat>> {
  const prefixes = [...new Set(horses.map((h) => h.jockey_name).filter((n): n is string => !!n && n.length >= 2))]

  const { data: allJockeys } = await supabase.from('jockeys').select('id, name, display_name')
  if (!allJockeys) return {}

  const matched: { prefix: string; id: string; fullName: string }[] = []
  for (const prefix of prefixes) {
    const found = allJockeys.find((j) => (j.name as string).startsWith(prefix))
    if (found) matched.push({ prefix, id: found.id as string, fullName: (found.display_name as string | null) ?? (found.name as string) })
  }
  if (matched.length === 0) return {}

  const jockeyIds = matched.map((m) => m.id)
  const bucket    = distBucket(distance)

  // 全体スタッツ + コース別スタッツを並行取得
  const [{ data: results }, { data: courseStats }] = await Promise.all([
    supabase
      .from('race_results')
      .select('jockey_id, finish_position')
      .in('jockey_id', jockeyIds),
    supabase
      .from('jockey_course_stats')
      .select('jockey_id, win_rate, top3_rate, race_count')
      .in('jockey_id', jockeyIds)
      .eq('course', course)
      .eq('track_type', trackType)
      .eq('dist_bucket', bucket),
  ])

  const courseMap = new Map((courseStats ?? []).map((s) => [s.jockey_id as string, s]))

  const statsMap: Record<string, JockeyStat> = {}
  for (const m of matched) {
    const rows = results?.filter((r) => r.jockey_id === m.id) ?? []
    const wins = rows.filter((r) => r.finish_position === 1).length
    const top3 = rows.filter((r) => r.finish_position != null && r.finish_position <= 3).length
    const cs   = courseMap.get(m.id)
    statsMap[m.prefix] = {
      fullName:        m.fullName,
      total:           rows.length,
      wins,
      top3,
      winRate:         rows.length > 0 ? Math.round((wins / rows.length) * 100) : 0,
      top3Rate:        rows.length > 0 ? Math.round((top3 / rows.length) * 100) : 0,
      courseWinRate:   cs ? Number(cs.win_rate)   : null,
      courseTop3Rate:  cs ? Number(cs.top3_rate)  : null,
      courseRaceCount: cs ? Number(cs.race_count) : null,
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

  const race        = horses[0]
  const jockeyStats = await fetchJockeyStats(horses, race.course, race.track_type, race.distance)

  const withData = [...horses]
    .filter((h) => h.avg_time_index != null)
    .sort((a, b) => (b.avg_time_index ?? 0) - (a.avg_time_index ?? 0))

  const noData = horses.filter((h) => h.avg_time_index == null)

  const buildHorseLine = (h: HorseWithHistory, rank?: number) => {
    const prefix = rank != null ? `${rank}位(指数): ` : '・'
    const jStat  = h.jockey_name ? jockeyStats[h.jockey_name] : null
    const courseNote = jStat?.courseRaceCount != null
      ? `[${race.course}${race.track_type}:勝率${jStat.courseWinRate}%・複${jStat.courseTop3Rate}%(${jStat.courseRaceCount}走)]`
      : ''
    const jInfo = jStat
      ? `騎手:${jStat.fullName}(全体勝率${jStat.winRate}%・複勝率${jStat.top3Rate}%${courseNote})`
      : `騎手:${h.jockey_name ?? '不明'}`
    const indexInfo = h.avg_time_index != null
      ? `平均指数:${h.avg_time_index.toFixed(1)} / 最高:${h.best_time_index?.toFixed(1) ?? '-'}`
      : 'タイム指数データなし'
    const recent = h.recent_results.slice(0, 3)
      .map((r) => `${r.date.slice(5)} ${r.finish_position ?? '-'}着(${r.time_index?.toFixed(1) ?? '-'})`)
      .join(' ')
    const hw = h.horse_weight
      ? `馬体重:${h.horse_weight}kg(${h.horse_weight_change != null ? (h.horse_weight_change > 0 ? '+' : '') + h.horse_weight_change : '±0'})`
      : ''
    const rotNote = h.rest_weeks != null
      ? (h.rest_weeks >= 12 ? `休み明け${h.rest_weeks}週` : h.rest_weeks >= 4 ? `中${h.rest_weeks}週` : '中1〜3週')
      : ''
    const jockeyNote = h.is_jockey_changed === true ? '乗り替わり' : ''
    const extras = [rotNote, jockeyNote].filter(Boolean).join('・')
    return `${prefix}${h.horse_name}（${jInfo} / ${indexInfo}${recent ? ' / 直近:' + recent : ''}${hw ? ' / ' + hw : ''}${extras ? ' / ' + extras : ''}）`
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
7日間累積: ${weather.precip7dayMm.toFixed(1)}mm
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
指数・コース別騎手勝率・馬体重変化を根拠に上位候補を2〜3頭解説。データなし馬も騎手勝率や斤量から評価する。3〜5文。

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
