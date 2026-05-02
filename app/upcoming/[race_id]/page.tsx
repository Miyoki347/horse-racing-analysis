import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GradeBadge } from '@/components/GradeBadge'
import { HistoryBasedRanking } from '@/components/HistoryBasedRanking'
import { WeatherCard } from '@/components/WeatherCard'
import { fetchWeatherForecast } from '@/lib/weather'
import { MLPredictButton } from '@/components/MLPredictButton'
import { AnalysisBettingSection } from '@/components/AnalysisBettingSection'
import { RefreshEntriesButton } from '@/components/RefreshEntriesButton'
import type { HorseWithHistory, UpcomingEntry } from '@/types/upcoming'
import type { WeatherResult } from '@/lib/weather'

interface PageProps {
  params: Promise<{ race_id: string }>
}

type RaceJoin = { date: string; race_name: string; distance: number; track_type: string } | null

type HistoryRow = {
  horse_id: string
  finish_position: number | null
  time_index: number | null
  last_3f_time: number | null
  races: RaceJoin
}

type LastRaceRow = {
  horse_id: string
  jockey_name: string | null
  date: string
}

// 騎手名の同一判定（出馬表は略称のためプレフィックスで比較）
function isSameJockey(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null
  return a.startsWith(b) || b.startsWith(a)
}

async function enrichWithHistory(entries: UpcomingEntry[]): Promise<HorseWithHistory[]> {
  const horseNames = entries.map((e) => e.horse_name)

  const { data: horseMaster } = await supabase
    .from('horses')
    .select('id, name')
    .in('name', horseNames)

  if (!horseMaster || horseMaster.length === 0) {
    return entries.map((e) => ({
      ...e,
      avg_time_index: null, best_time_index: null,
      rest_weeks: null, is_jockey_changed: null,
      jockey_course_win_rate: null, jockey_course_top3_rate: null, jockey_course_race_count: null,
      recent_results: [],
    }))
  }

  const nameToId = Object.fromEntries(horseMaster.map((h: { name: string; id: string }) => [h.name, h.id]))
  const horseIds = horseMaster.map((h: { id: string }) => h.id)

  // タイム指数履歴 + 全出走（最終騎手・日付取得用）を並行取得
  const [{ data: rawResults }, { data: rawLatest }] = await Promise.all([
    supabase
      .from('race_results')
      .select('horse_id, finish_position, time_index, last_3f_time, races(date, race_name, distance, track_type)')
      .in('horse_id', horseIds)
      .not('time_index', 'is', null),
    supabase
      .from('race_results')
      .select('horse_id, jockeys(name, display_name), races(date)')
      .in('horse_id', horseIds),
  ])

  const results: HistoryRow[] = (rawResults ?? []).map((r) => ({
    horse_id:        r.horse_id as string,
    finish_position: r.finish_position as number | null,
    time_index:      r.time_index as number | null,
    last_3f_time:    r.last_3f_time as number | null,
    races:           r.races as unknown as RaceJoin,
  }))

  // 馬ごとの最終出走情報（最新日付）
  const latestMap = new Map<string, LastRaceRow>()
  for (const r of rawLatest ?? []) {
    const date       = (r.races as unknown as { date: string } | null)?.date ?? ''
    const _j         = r.jockeys as unknown as { name: string; display_name: string | null } | null
    const jockeyName = _j?.display_name ?? _j?.name ?? null
    const horseId    = r.horse_id as string
    const existing   = latestMap.get(horseId)
    if (!existing || date > existing.date) {
      latestMap.set(horseId, { horse_id: horseId, jockey_name: jockeyName, date })
    }
  }

  const historyMap: Record<string, HistoryRow[]> = {}
  for (const r of results) {
    if (!historyMap[r.horse_id]) historyMap[r.horse_id] = []
    historyMap[r.horse_id].push(r)
  }
  for (const id of Object.keys(historyMap)) {
    historyMap[id] = historyMap[id]
      .sort((a, b) => (b.races?.date ?? '').localeCompare(a.races?.date ?? ''))
      .slice(0, 5)
  }

  return entries.map((entry) => {
    const horseId  = nameToId[entry.horse_name] as string | undefined
    const history  = horseId ? (historyMap[horseId] ?? []) : []
    const indices  = history.map((r) => r.time_index).filter((v): v is number => v != null)
    const lastRace = horseId ? latestMap.get(horseId) : null

    // 休み明け週数
    const restWeeks = lastRace?.date
      ? Math.floor((new Date(entry.race_date).getTime() - new Date(lastRace.date).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : null

    // 乗り替わり（名前の部分一致で同一騎手を判定）
    const same = isSameJockey(lastRace?.jockey_name ?? null, entry.jockey_name)
    const isJockeyChanged = same === null ? null : !same

    return {
      ...entry,
      avg_time_index:           indices.length > 0 ? indices.reduce((s, v) => s + v, 0) / indices.length : null,
      best_time_index:          indices.length > 0 ? Math.max(...indices) : null,
      rest_weeks:               restWeeks,
      is_jockey_changed:        isJockeyChanged,
      jockey_course_win_rate:   null,
      jockey_course_top3_rate:  null,
      jockey_course_race_count: null,
      recent_results:    history.map((r) => ({
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
}

export default async function UpcomingRacePage({ params }: PageProps) {
  const { race_id } = await params

  const { data: entries } = await supabase
    .from('upcoming_entries')
    .select('*')
    .eq('netkeiba_race_id', race_id)
    .order('horse_number')

  if (!entries || entries.length === 0) notFound()

  const race = entries[0]

  // 天気予報・馬場推定・馬の過去成績を並行取得
  const [horses, weather] = await Promise.all([
    enrichWithHistory(entries as UpcomingEntry[]),
    fetchWeatherForecast(race.course, race.race_date) as Promise<WeatherResult | null>,
  ])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        <Link href="/upcoming" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          ← 出走予定一覧に戻る
        </Link>

        {/* レース情報 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <GradeBadge grade={race.grade} />
            <h1 className="text-xl font-bold text-gray-900">{race.race_name}</h1>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-gray-600">
            <div><span className="text-xs text-gray-400 block">開催日</span>{race.race_date}</div>
            <div><span className="text-xs text-gray-400 block">会場</span>{race.course}</div>
            <div><span className="text-xs text-gray-400 block">距離・種別</span>{race.track_type} {race.distance}m</div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <RefreshEntriesButton raceId={race_id} />
            <p className="mt-1 text-xs text-gray-400">取消・乗り替わりなど最新の出馬表に更新します</p>
          </div>
        </div>

        {/* 天気予報・推定馬場 */}
        {weather && <WeatherCard weather={weather} />}

        {/* 予測ランキング */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-2">🏆 予測ランキング</h2>
          <MLPredictButton
            raceId={race_id}
            hasML={horses.some((h) => h.ml_score != null)}
          />
          <HistoryBasedRanking horses={horses} />
        </div>

        {/* AI展開分析 + 馬券3パターン */}
        <AnalysisBettingSection raceId={race_id} horses={horses} weather={weather} />

      </div>
    </main>
  )
}
