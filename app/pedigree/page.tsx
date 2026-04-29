import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SiteHeader } from '@/components/SiteHeader'

const DIST_BUCKETS  = ['短距離', 'マイル', '中距離', '長距離'] as const
const TRACK_TYPES   = ['芝', 'ダート'] as const
const CONDITIONS    = [
  { value: '0', label: '良'  },
  { value: '1', label: '稍重' },
  { value: '2', label: '重'  },
  { value: '3', label: '不良' },
] as const

const MIN_RUNS = 3

interface PageProps {
  searchParams: Promise<{ track_type?: string; condition?: string }>
}

type Entry = {
  sire_line:         string
  distance_category: string
  runs:              number
  top3_rate:         number
}

function top3Color(rate: number): string {
  if (rate === 0)  return 'bg-gray-50 text-gray-400'
  if (rate < 20)   return 'bg-emerald-50 text-emerald-500'
  if (rate < 30)   return 'bg-emerald-100 text-emerald-600 font-medium'
  if (rate < 40)   return 'bg-emerald-200 text-emerald-700 font-semibold'
  if (rate < 50)   return 'bg-emerald-300 text-emerald-800 font-bold'
  return 'bg-emerald-500 text-white font-bold'
}

export default async function PedigreePage({ searchParams }: PageProps) {
  const sp        = await searchParams
  const trackType = (TRACK_TYPES as readonly string[]).includes(sp.track_type ?? '') ? sp.track_type! : '芝'
  const condition = ['0', '1', '2', '3'].includes(sp.condition ?? '') ? Number(sp.condition) : 0

  const { data } = await supabase
    .from('sire_line_aptitude')
    .select('sire_line, distance_category, runs, top3_rate')
    .eq('track_type', trackType)
    .eq('track_condition', condition)
    .gte('runs', MIN_RUNS)

  const entries: Entry[] = (data ?? []).map((d) => ({
    sire_line:         d.sire_line as string,
    distance_category: d.distance_category as string,
    runs:              Number(d.runs),
    top3_rate:         Number(d.top3_rate),
  }))

  // 父系統ごとの総出走数（行の並び順に使用）
  const totalMap = new Map<string, number>()
  for (const e of entries) {
    totalMap.set(e.sire_line, (totalMap.get(e.sire_line) ?? 0) + e.runs)
  }
  const sireLines = [...totalMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sl]) => sl)

  // ルックアップ: 父系統 × 距離帯 → Entry
  const lookup = new Map<string, Entry>()
  for (const e of entries) {
    lookup.set(`${e.sire_line}|${e.distance_category}`, e)
  }

  function href(overrides: Record<string, string>) {
    const p = new URLSearchParams({ track_type: trackType, condition: String(condition), ...overrides })
    return `/pedigree?${p}`
  }

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
      active
        ? 'bg-gray-800 text-white border-gray-800'
        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
    }`

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <SiteHeader active="pedigree" />

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">血統適性マップ</h2>
          <p className="text-sm text-gray-500">
            父系統 × 距離帯の複勝率（3着以内率）。{MIN_RUNS}走以上のデータのみ表示。
          </p>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-2">種別</p>
            <div className="flex gap-2">
              {TRACK_TYPES.map((t) => (
                <Link key={t} href={href({ track_type: t })} className={pill(trackType === t)}>{t}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">馬場状態</p>
            <div className="flex gap-2 flex-wrap">
              {CONDITIONS.map((c) => (
                <Link key={c.value} href={href({ condition: c.value })} className={pill(condition === Number(c.value))}>
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ヒートマップ */}
        {sireLines.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>該当データがありません。</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr>
                    <th className="text-left pr-4 pb-3 text-gray-500 font-medium whitespace-nowrap">父系統</th>
                    <th className="px-2 pb-3 text-xs text-gray-400 font-normal text-center whitespace-nowrap">総出走</th>
                    {DIST_BUCKETS.map((b) => (
                      <th key={b} className="px-1 pb-3 text-xs text-gray-400 font-normal min-w-[5rem] text-center">
                        {b}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sireLines.map((sl) => (
                    <tr key={sl} className="border-t border-gray-50">
                      <td className="pr-4 py-2 text-gray-700 font-medium whitespace-nowrap">{sl}</td>
                      <td className="px-2 py-2 text-center text-xs text-gray-400">
                        {totalMap.get(sl)}
                      </td>
                      {DIST_BUCKETS.map((bucket) => {
                        const entry = lookup.get(`${sl}|${bucket}`)
                        return (
                          <td key={bucket} className="px-1 py-1">
                            {entry ? (
                              <div className={`rounded-md px-2 py-1.5 text-center ${top3Color(entry.top3_rate)}`}>
                                <div className="font-mono text-xs">{entry.top3_rate.toFixed(0)}%</div>
                                <div className="text-[10px] opacity-70">{entry.runs}走</div>
                              </div>
                            ) : (
                              <div className="rounded-md px-2 py-1.5 text-center bg-gray-50 text-gray-200 text-xs">
                                —
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
            <p className="mt-4 text-xs text-gray-400">
              数値は複勝率（3着以内率）。濃い緑ほど適性が高い。
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
