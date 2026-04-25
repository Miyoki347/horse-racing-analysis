import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { HorseWithHistory } from '@/types/upcoming'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export interface SimConditions {
  distance: number
  track_type: string
  track_condition: number | null
  course: string
}

type RaceJoin = { date: string; race_name: string; distance: number; track_type: string; track_condition: number } | null

function distBucket(distance: number): string {
  if (distance <= 1400) return 'short'
  if (distance <= 1800) return 'mile'
  if (distance <= 2200) return 'middle'
  return 'long'
}

export async function POST(req: NextRequest) {
  const { horseIds, conditions }: { horseIds: string[]; conditions: SimConditions } = await req.json()
  if (!horseIds?.length) return NextResponse.json([])

  const { data: horses } = await supabase
    .from('horses')
    .select('id, name')
    .in('id', horseIds)

  if (!horses?.length) return NextResponse.json([])

  const { data: rawResults } = await supabase
    .from('race_results')
    .select('horse_id, finish_position, time_index, last_3f_time, jockey_id, jockeys(name, display_name), races(date, race_name, distance, track_type, track_condition)')
    .in('horse_id', horseIds)
    .not('time_index', 'is', null)

  const results = (rawResults ?? []).map((r) => ({
    horse_id:        r.horse_id as string,
    finish_position: r.finish_position as number | null,
    time_index:      r.time_index as number | null,
    last_3f_time:    r.last_3f_time as number | null,
    jockey_id:       r.jockey_id as string | null,
    jockey_name:     ((r.jockeys as unknown as { name: string; display_name: string | null } | null))?.display_name
                     ?? ((r.jockeys as unknown as { name: string } | null))?.name ?? null,
    races:           r.races as unknown as RaceJoin,
  }))

  // 最新出走の騎手IDを馬ごとに特定
  const latestJockeyIdMap = new Map<string, string>()
  for (const horseId of horseIds) {
    const latest = results
      .filter((r) => r.horse_id === horseId && r.jockey_id)
      .sort((a, b) => (b.races?.date ?? '').localeCompare(a.races?.date ?? ''))
      .at(0)
    if (latest?.jockey_id) latestJockeyIdMap.set(horseId, latest.jockey_id)
  }

  const jockeyIds = [...new Set(latestJockeyIdMap.values())]
  const bucket    = distBucket(conditions.distance)

  // コース別騎手スタッツを取得
  const { data: courseStats } = jockeyIds.length > 0
    ? await supabase
        .from('jockey_course_stats')
        .select('jockey_id, win_rate, top3_rate, race_count')
        .in('jockey_id', jockeyIds)
        .eq('course', conditions.course)
        .eq('track_type', conditions.track_type)
        .eq('dist_bucket', bucket)
    : { data: [] }

  const courseStatsMap = new Map((courseStats ?? []).map((s) => [s.jockey_id as string, s]))

  const enriched: HorseWithHistory[] = horses.map((horse) => {
    const horseResults = results.filter((r) => r.horse_id === horse.id)

    const condMatched = horseResults.filter((r) => {
      const race = r.races
      if (!race) return false
      return race.track_type === conditions.track_type &&
             Math.abs(race.distance - conditions.distance) <= 200
    })

    const useResults = condMatched.length > 0 ? condMatched : horseResults

    const sorted = [...useResults]
      .sort((a, b) => (b.races?.date ?? '').localeCompare(a.races?.date ?? ''))
      .slice(0, 5)

    const indices        = sorted.map((r) => r.time_index).filter((v): v is number => v != null)
    const avg_time_index  = indices.length > 0 ? indices.reduce((s, v) => s + v, 0) / indices.length : null
    const best_time_index = indices.length > 0 ? Math.max(...indices) : null

    const latestEntry = horseResults
      .sort((a, b) => (b.races?.date ?? '').localeCompare(a.races?.date ?? ''))
      .at(0)

    const jockeyId   = latestJockeyIdMap.get(horse.id) ?? null
    const cs         = jockeyId ? courseStatsMap.get(jockeyId) : null

    return {
      id:                  horse.id,
      netkeiba_race_id:    '',
      race_name:           '',
      race_date:           '',
      course:              conditions.course,
      distance:            conditions.distance,
      track_type:          conditions.track_type,
      grade:               null,
      post_position:       null,
      horse_number:        null,
      horse_name:          horse.name,
      jockey_name:         latestEntry?.jockey_name ?? null,
      trainer_name:        null,
      weight_carried:      null,
      horse_weight:        null,
      horse_weight_change: null,
      avg_time_index,
      best_time_index,
      rest_weeks:                null,
      is_jockey_changed:         null,
      jockey_course_win_rate:    cs ? Number(cs.win_rate)   : null,
      jockey_course_top3_rate:   cs ? Number(cs.top3_rate)  : null,
      jockey_course_race_count:  cs ? Number(cs.race_count) : null,
      recent_results: sorted.map((r) => ({
        date:            r.races?.date ?? '',
        race_name:       r.races?.race_name ?? '',
        finish_position: r.finish_position,
        time_index:      r.time_index,
        last_3f_time:    r.last_3f_time,
        distance:        r.races?.distance ?? 0,
        track_type:      r.races?.track_type ?? '',
      })),
    }
  })

  return NextResponse.json(enriched)
}
