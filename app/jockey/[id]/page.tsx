import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SiteHeader } from '@/components/SiteHeader'
import { GradeBadge } from '@/components/GradeBadge'

const COURSES     = ['東京', '中山', '阪神', '京都', '中京', '小倉', '函館', '札幌', '福島', '新潟'] as const
const DIST_BUCKETS = ['短距離', 'マイル', '中距離', '長距離'] as const
const TRACK_TYPES  = ['芝', 'ダート'] as const

interface PageProps {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ track_type?: string }>
}

function distBucket(d: number): string {
  if (d < 1400) return '短距離'
  if (d < 1800) return 'マイル'
  if (d < 2200) return '中距離'
  return '長距離'
}

function heatColor(winRate: number, rides: number): string {
  if (rides === 0) return 'bg-gray-50 text-gray-200'
  if (winRate === 0) return 'bg-gray-50 text-gray-400'
  if (winRate < 10)  return 'bg-indigo-50 text-indigo-500'
  if (winRate < 20)  return 'bg-indigo-100 text-indigo-600 font-medium'
  if (winRate < 30)  return 'bg-indigo-200 text-indigo-700 font-semibold'
  return 'bg-indigo-400 text-white font-bold'
}

type RaceRef = {
  date: string; race_name: string; course: string
  track_type: string; distance: number
  grade: string | null; netkeiba_race_id: string | null
} | null

type Result = {
  finish_position: number | null
  time_index:      number | null
  odds:            number | null
  popularity:      number | null
  races:           RaceRef
  horses:          { name: string } | null
}

export default async function JockeyProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp      = await searchParams
  const trackType = (TRACK_TYPES as readonly string[]).includes(sp.track_type ?? '')
    ? sp.track_type!
    : '芝'

  const { data: jockey } = await supabase
    .from('jockeys')
    .select('id, name, display_name')
    .eq('id', id)
    .single()

  if (!jockey) notFound()

  const displayName = (jockey.display_name as string | null) ?? (jockey.name as string)

  const [{ data: indexStats }, { data: rawResults }] = await Promise.all([
    supabase
      .from('jockey_index')
      .select('total_rides, wins, win_rate, overperform_rate, avg_rank_gain')
      .eq('jockey_id', id)
      .single(),
    supabase
      .from('race_results')
      .select('finish_position, time_index, odds, popularity, races(date, race_name, course, track_type, distance, grade, netkeiba_race_id), horses(name)')
      .eq('jockey_id', id),
  ])

  const results: Result[] = (rawResults ?? []).map((r) => ({
    finish_position: r.finish_position as number | null,
    time_index:      r.time_index      as number | null,
    odds:            r.odds            as number | null,
    popularity:      r.popularity      as number | null,
    races:           r.races           as unknown as RaceRef,
    horses:          r.horses          as unknown as { name: string } | null,
  }))

  const sorted = [...results]
    .filter((r) => r.races)
    .sort((a, b) => b.races!.date.localeCompare(a.races!.date))

  // Heatmap 集計
  type Cell = { rides: number; wins: number; top3: number }
  const heatmap = new Map<string, Cell>()
  for (const r of sorted) {
    if (!r.races || r.races.track_type !== trackType || r.finish_position == null) continue
    const key  = `${r.races.course}|${distBucket(r.races.distance)}`
    const cell = heatmap.get(key) ?? { rides: 0, wins: 0, top3: 0 }
    heatmap.set(key, {
      rides: cell.rides + 1,
      wins:  cell.wins  + (r.finish_position === 1 ? 1 : 0),
      top3:  cell.top3  + (r.finish_position <= 3  ? 1 : 0),
    })
  }

  const recentHistory = sorted.slice(0, 30)

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
      active
        ? 'bg-gray-800 text-white border-gray-800'
        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
    }`

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <SiteHeader active="jockey" />

        <Link href="/jockey" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          ← 騎手ランキングに戻る
        </Link>

        {/* ヘッダー */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{displayName}</h1>
          {indexStats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '出走数',       value: String(indexStats.total_rides) },
                  { label: '勝利数',       value: `${indexStats.wins}勝` },
                  { label: '勝率',         value: `${Number(indexStats.win_rate).toFixed(1)}%` },
                  { label: 'Jockey Index', value: `${Number(indexStats.overperform_rate).toFixed(1)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="text-lg font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-500">
                平均着順上昇:{' '}
                <span className={`font-semibold ${Number(indexStats.avg_rank_gain) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {Number(indexStats.avg_rank_gain) > 0 ? '+' : ''}
                  {Number(indexStats.avg_rank_gain).toFixed(2)}
                </span>
                <span className="ml-1 text-xs text-gray-400">（人気に対する着順の平均差分）</span>
              </p>
            </>
          )}
        </div>

        {/* ヒートマップ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-800">🗺️ コース別勝率</h2>
            <div className="flex gap-2">
              {TRACK_TYPES.map((t) => (
                <Link key={t} href={`/jockey/${id}?track_type=${t}`} className={pill(trackType === t)}>
                  {t}
                </Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left pr-3 pb-2 text-gray-400 font-normal">会場</th>
                  {DIST_BUCKETS.map((b) => (
                    <th key={b} className="px-1 pb-2 text-gray-400 font-normal min-w-[4.5rem]">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COURSES.map((course) => (
                  <tr key={course}>
                    <td className="pr-3 py-1 text-gray-500 whitespace-nowrap">{course}</td>
                    {DIST_BUCKETS.map((bucket) => {
                      const cell    = heatmap.get(`${course}|${bucket}`)
                      const winRate = cell ? (cell.wins / cell.rides) * 100 : 0
                      return (
                        <td key={bucket} className="px-1 py-1">
                          {cell ? (
                            <div className={`rounded-md px-2 py-1.5 text-center ${heatColor(winRate, cell.rides)}`}>
                              <div className="font-mono">{winRate.toFixed(0)}%</div>
                              <div className="text-[10px] opacity-70">{cell.rides}走</div>
                            </div>
                          ) : (
                            <div className="rounded-md px-2 py-1.5 text-center bg-gray-50 text-gray-200">
                              <div>—</div>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 直近出走履歴 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">📋 直近出走履歴（{recentHistory.length}件）</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-gray-400 border-b border-gray-100">
                <tr>
                  {['日付', 'レース名', '騎乗馬', '会場', '着順', 'T指数', '人気'].map((h) => (
                    <th key={h} className="py-2 pr-4 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentHistory.map((r, i) => {
                  const pos = r.finish_position
                  return (
                    <tr key={i} className={
                      pos === 1 ? 'bg-yellow-50' :
                      pos === 2 ? 'bg-gray-50'   :
                      pos === 3 ? 'bg-orange-50'  : ''
                    }>
                      <td className="py-2 pr-4 text-gray-400 whitespace-nowrap text-xs">{r.races?.date ?? '-'}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {r.races?.grade && <GradeBadge grade={r.races.grade} />}
                          {r.races?.netkeiba_race_id ? (
                            <Link href={`/race/${r.races.netkeiba_race_id}`} className="text-indigo-600 hover:underline text-xs">
                              {r.races.race_name}
                            </Link>
                          ) : (
                            <span className="text-xs">{r.races?.race_name ?? '-'}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {r.horses?.name ? (
                          <Link href={`/horse/${encodeURIComponent(r.horses.name)}`} className="text-indigo-600 hover:underline">
                            {r.horses.name}
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                        {r.races ? `${r.races.course} ${r.races.track_type}${r.races.distance}m` : '-'}
                      </td>
                      <td className="py-2 pr-4 font-bold text-center">
                        {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos ?? '-'}
                      </td>
                      <td className="py-2 pr-4 font-mono text-indigo-600 font-semibold text-center text-xs">
                        {r.time_index?.toFixed(1) ?? '-'}
                      </td>
                      <td className="py-2 pr-4 text-center text-xs text-gray-500">
                        {r.popularity != null ? `${r.popularity}番人気` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  )
}
