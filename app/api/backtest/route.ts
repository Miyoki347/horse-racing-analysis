import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const GRADE_FILTERS: Record<string, string[]> = {
  g1:   ['G1'],
  g1g2: ['G1', 'G2'],
  g3:   ['G1', 'G2', 'G3'],
  all:  [],
}

type RaceInfo = {
  date: string
  race_name: string
  grade: string | null
  netkeiba_race_id: string | null
}

type Raw = {
  race_id:         string
  finish_position: number
  time_index:      number
  odds:            number | null
  races:           RaceInfo | null
}

export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams
  const rank  = Math.max(1, Math.min(3, parseInt(sp.get('rank') ?? '1')))
  const grade = Object.keys(GRADE_FILTERS).includes(sp.get('grade') ?? '') ? sp.get('grade')! : 'g1'
  const bet   = [100, 500, 1000].includes(parseInt(sp.get('bet') ?? '')) ? parseInt(sp.get('bet')!) : 100

  // 総レコード数を取得してページ数を計算
  const { count } = await supabase
    .from('race_results')
    .select('*', { count: 'exact', head: true })
    .not('time_index', 'is', null)
    .not('finish_position', 'is', null)

  const pages = Math.min(Math.ceil((count ?? 0) / 1000), 25)

  // 全ページを並列フェッチ
  const batches = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from('race_results')
        .select('race_id, finish_position, time_index, odds, races(date, race_name, grade, netkeiba_race_id)')
        .not('time_index', 'is', null)
        .not('finish_position', 'is', null)
        .range(i * 1000, (i + 1) * 1000 - 1)
    )
  )

  let allRaw: Raw[] = batches.flatMap((b) => (b.data ?? []) as unknown as Raw[])

  // グレードフィルター
  const gradeList = GRADE_FILTERS[grade]
  allRaw = gradeList.length > 0
    ? allRaw.filter((r) => r.races && gradeList.includes(r.races.grade ?? ''))
    : allRaw.filter((r) => r.races != null)

  // レースごとにグループ化
  const byRace = new Map<string, Raw[]>()
  const raceInfoMap = new Map<string, RaceInfo>()
  for (const r of allRaw) {
    const list = byRace.get(r.race_id) ?? []
    list.push(r)
    byRace.set(r.race_id, list)
    if (r.races && !raceInfoMap.has(r.race_id)) raceInfoMap.set(r.race_id, r.races)
  }

  // 日付順にソート
  const sortedRaceIds = [...raceInfoMap.entries()]
    .sort((a, b) => a[1].date.localeCompare(b[1].date))
    .map(([id]) => id)

  // バックテスト実行
  let totalInvested = 0
  let totalReturn   = 0
  let wins          = 0

  type TimelineEntry = {
    date:             string
    race_name:        string
    grade:            string | null
    netkeiba_race_id: string | null
    hit:              boolean
    gain:             number
    net:              number
    odds:             number | null
    cumulative:       number
  }

  const timeline: TimelineEntry[] = []

  for (const raceId of sortedRaceIds) {
    const entries = byRace.get(raceId) ?? []
    const sorted  = [...entries].sort((a, b) => b.time_index - a.time_index)
    if (sorted.length < rank) continue

    const target = sorted[rank - 1]
    totalInvested += bet

    let gain = 0
    if (target.finish_position === 1 && target.odds != null) {
      gain = Math.round(target.odds * bet)
      wins++
    }
    totalReturn += gain

    const info = raceInfoMap.get(raceId)!
    timeline.push({
      date:             info.date,
      race_name:        info.race_name,
      grade:            info.grade,
      netkeiba_race_id: info.netkeiba_race_id,
      hit:              target.finish_position === 1,
      gain,
      net:              gain - bet,
      odds:             target.odds,
      cumulative:       totalReturn - totalInvested,
    })
  }

  return NextResponse.json({
    summary: {
      races:          timeline.length,
      wins,
      hit_rate:       timeline.length > 0 ? (wins / timeline.length * 100).toFixed(1) : '0.0',
      total_invested: totalInvested,
      total_return:   totalReturn,
      roi:            totalInvested > 0 ? ((totalReturn / totalInvested - 1) * 100).toFixed(1) : '0.0',
    },
    bet,
    timeline,
  })
}
