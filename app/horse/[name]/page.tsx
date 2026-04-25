import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GradeBadge } from '@/components/GradeBadge'
import { HorseIndexChart } from '@/components/HorseIndexChart'

interface PageProps {
  params: Promise<{ name: string }>
}

type RaceInfo = {
  date: string
  race_name: string
  course: string
  distance: number
  track_type: string
  grade: string | null
  netkeiba_race_id: string
} | null

type HorseResult = {
  finish_position: number | null
  time_index: number | null
  last_3f_time: number | null
  horse_weight: number | null
  horse_weight_change: number | null
  weight_carried: number | null
  jockeys: { name: string; display_name: string | null } | null
  races: RaceInfo
}

function distLabel(d: number): string {
  if (d <= 1400) return '短距離'
  if (d <= 1800) return 'マイル'
  if (d <= 2200) return '中距離'
  return '長距離'
}

export default async function HorsePage({ params }: PageProps) {
  const { name } = await params
  const horseName = decodeURIComponent(name)

  const { data: horse } = await supabase
    .from('horses')
    .select('id, name, sire, dam, bms, sire_line, bms_line')
    .eq('name', horseName)
    .single()

  if (!horse) notFound()

  const { data: rawResults } = await supabase
    .from('race_results')
    .select('finish_position, time_index, last_3f_time, horse_weight, horse_weight_change, weight_carried, jockeys(name, display_name), races(date, race_name, course, distance, track_type, grade, netkeiba_race_id)')
    .eq('horse_id', horse.id)

  const results: HorseResult[] = (rawResults ?? []).map((r) => ({
    finish_position:     r.finish_position as number | null,
    time_index:          r.time_index as number | null,
    last_3f_time:        r.last_3f_time as number | null,
    horse_weight:        r.horse_weight as number | null,
    horse_weight_change: r.horse_weight_change as number | null,
    weight_carried:      r.weight_carried as number | null,
    jockeys:             r.jockeys as unknown as { name: string; display_name: string | null } | null,
    races:               r.races as unknown as RaceInfo,
  }))

  const sorted = [...results].sort((a, b) =>
    (b.races?.date ?? '').localeCompare(a.races?.date ?? ''),
  )

  // サマリー
  const indices  = sorted.map((r) => r.time_index).filter((v): v is number => v != null)
  const avgIndex = indices.length > 0 ? (indices.reduce((s, v) => s + v, 0) / indices.length).toFixed(1) : '-'
  const bestIndex = indices.length > 0 ? Math.max(...indices).toFixed(1) : '-'
  const wins  = sorted.filter((r) => r.finish_position === 1).length
  const total = sorted.length

  // コース別成績
  type CourseStat = { course: string; track_type: string; dist: string; count: number; wins: number; top3: number; idx: number[] }
  const courseMap = new Map<string, CourseStat>()
  for (const r of sorted) {
    if (!r.races) continue
    const key = `${r.races.course}|${r.races.track_type}|${distLabel(r.races.distance)}`
    if (!courseMap.has(key)) {
      courseMap.set(key, { course: r.races.course, track_type: r.races.track_type, dist: distLabel(r.races.distance), count: 0, wins: 0, top3: 0, idx: [] })
    }
    const cs = courseMap.get(key)!
    cs.count++
    if (r.finish_position === 1) cs.wins++
    if (r.finish_position != null && r.finish_position <= 3) cs.top3++
    if (r.time_index != null) cs.idx.push(r.time_index)
  }
  const courseStats = [...courseMap.values()].sort((a, b) => b.count - a.count)

  // チャートデータ（古い順）
  const chartData = [...sorted].reverse()
    .filter((r) => r.time_index != null && r.races)
    .map((r) => ({
      date:  r.races!.date.slice(5),
      index: r.time_index!,
      name:  r.races!.race_name,
    }))

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        <Link href="/" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          ← レース一覧に戻る
        </Link>

        {/* ヘッダー */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{horse.name}</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-gray-600">
            <div><span className="text-xs text-gray-400 block">父</span>{horse.sire ?? '-'}</div>
            <div><span className="text-xs text-gray-400 block">母</span>{horse.dam ?? '-'}</div>
            <div><span className="text-xs text-gray-400 block">母父</span>{horse.bms ?? '-'}</div>
            {horse.sire_line && <div><span className="text-xs text-gray-400 block">父系統</span>{horse.sire_line}</div>}
            {horse.bms_line  && <div><span className="text-xs text-gray-400 block">母父系統</span>{horse.bms_line}</div>}
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '出走数',    value: String(total) },
            { label: '勝利数',    value: `${wins}勝` },
            { label: '平均指数',  value: avgIndex },
            { label: '最高指数',  value: bestIndex },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* タイム指数推移 */}
        {chartData.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">📈 タイム指数推移</h2>
            <HorseIndexChart data={chartData} />
          </div>
        )}

        {/* コース別成績 */}
        {courseStats.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">📊 コース別成績</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-gray-400 border-b border-gray-100">
                  <tr>
                    {['会場', '種別', '距離帯', '出走', '勝', '複勝', '平均指数'].map((h) => (
                      <th key={h} className="py-2 pr-5 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courseStats.map((cs) => {
                    const avg = cs.idx.length > 0
                      ? (cs.idx.reduce((s, v) => s + v, 0) / cs.idx.length).toFixed(1)
                      : '-'
                    return (
                      <tr key={`${cs.course}-${cs.track_type}-${cs.dist}`} className="text-gray-700">
                        <td className="py-2 pr-5">{cs.course}</td>
                        <td className="py-2 pr-5">{cs.track_type}</td>
                        <td className="py-2 pr-5 text-gray-500">{cs.dist}</td>
                        <td className="py-2 pr-5 text-center">{cs.count}</td>
                        <td className="py-2 pr-5 text-center font-semibold">{cs.wins}</td>
                        <td className="py-2 pr-5 text-center">{cs.top3}</td>
                        <td className="py-2 pr-5 font-mono text-indigo-600 font-semibold">{avg}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 全出走履歴 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">📋 全出走履歴</h2>
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400">出走データがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-gray-400 border-b border-gray-100">
                  <tr>
                    {['日付', 'レース名', '会場', '距離・種別', '着順', 'T指数', '上3F', '騎手', '馬体重'].map((h) => (
                      <th key={h} className="py-2 pr-4 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((r, i) => {
                    const pos = r.finish_position
                    return (
                      <tr key={i} className={
                        pos === 1 ? 'bg-yellow-50' :
                        pos === 2 ? 'bg-gray-50' :
                        pos === 3 ? 'bg-orange-50' : ''
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
                        <td className="py-2 pr-4 text-xs">{r.races?.course ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-gray-500">
                          {r.races ? `${r.races.track_type} ${r.races.distance}m` : '-'}
                        </td>
                        <td className="py-2 pr-4 font-bold text-center">
                          {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos ?? '-'}
                        </td>
                        <td className="py-2 pr-4 font-mono text-indigo-600 font-semibold text-center">
                          {r.time_index?.toFixed(1) ?? '-'}
                        </td>
                        <td className="py-2 pr-4 text-center text-xs text-gray-500">{r.last_3f_time ?? '-'}</td>
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-gray-600">{r.jockeys?.display_name ?? r.jockeys?.name ?? '-'}</td>
                        <td className="py-2 pr-4 text-center text-xs">
                          {r.horse_weight ?? '-'}
                          {r.horse_weight_change != null && (
                            <span className={`ml-1 ${r.horse_weight_change > 0 ? 'text-red-400' : r.horse_weight_change < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                              ({r.horse_weight_change > 0 ? '+' : ''}{r.horse_weight_change})
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
