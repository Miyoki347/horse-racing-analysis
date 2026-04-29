import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SiteHeader } from '@/components/SiteHeader'

const COURSES     = ['東京', '中山', '阪神', '京都', '中京', '小倉', '函館', '札幌', '福島', '新潟'] as const
const TRACK_TYPES = ['芝', 'ダート'] as const
const DIST_BUCKETS = [
  { key: 'short',  label: '短距離', sub: '〜1400m' },
  { key: 'mile',   label: 'マイル', sub: '〜1800m' },
  { key: 'middle', label: '中距離', sub: '〜2200m' },
  { key: 'long',   label: '長距離', sub: '2200m〜' },
] as const

type DistKey = typeof DIST_BUCKETS[number]['key']

interface PageProps {
  searchParams: Promise<{ course?: string; track_type?: string; dist_bucket?: string }>
}

export default async function JockeyPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const course     = (COURSES as readonly string[]).includes(sp.course ?? '')         ? sp.course!      : '東京'
  const trackType  = (TRACK_TYPES as readonly string[]).includes(sp.track_type ?? '') ? sp.track_type!  : '芝'
  const distBucket = (DIST_BUCKETS.map(d => d.key) as string[]).includes(sp.dist_bucket ?? '')
    ? (sp.dist_bucket as DistKey)
    : 'mile'

  const { data: stats } = await supabase
    .from('jockey_course_stats')
    .select('jockey_id, win_rate, top3_rate, race_count')
    .eq('course', course)
    .eq('track_type', trackType)
    .eq('dist_bucket', distBucket)
    .order('win_rate', { ascending: false })

  const jockeyIds = (stats ?? []).map((s) => s.jockey_id as string)
  const { data: jockeys } = jockeyIds.length > 0
    ? await supabase.from('jockeys').select('id, name, display_name').in('id', jockeyIds)
    : { data: [] }

  const nameMap = Object.fromEntries(
    (jockeys ?? []).map((j) => [j.id as string, (j.display_name as string | null) ?? (j.name as string)])
  )

  const rows = (stats ?? []).map((s) => ({
    jockey_id:  s.jockey_id as string,
    name:       nameMap[s.jockey_id as string] ?? '不明',
    win_rate:   Number(s.win_rate),
    top3_rate:  Number(s.top3_rate),
    race_count: Number(s.race_count),
  }))

  const maxWinRate = rows[0]?.win_rate ?? 1

  function href(overrides: Record<string, string>) {
    const p = new URLSearchParams({ course, track_type: trackType, dist_bucket: distBucket, ...overrides })
    return `/jockey?${p}`
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
        <SiteHeader active="jockey" />

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">騎手ランキング</h2>
          <p className="text-sm text-gray-500">コース・距離別の騎手成績（5走以上）</p>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-2">会場</p>
            <div className="flex gap-2 flex-wrap">
              {COURSES.map((c) => (
                <Link key={c} href={href({ course: c })} className={pill(course === c)}>{c}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">種別</p>
            <div className="flex gap-2">
              {TRACK_TYPES.map((t) => (
                <Link key={t} href={href({ track_type: t })} className={pill(trackType === t)}>{t}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">距離</p>
            <div className="flex gap-2 flex-wrap">
              {DIST_BUCKETS.map((d) => (
                <Link key={d.key} href={href({ dist_bucket: d.key })} className={pill(distBucket === d.key)}>
                  {d.label}
                  <span className="ml-1 text-xs opacity-60">{d.sub}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ランキング */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>該当データがありません。</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem_4rem] gap-x-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-medium">
              <span>#</span>
              <span>騎手</span>
              <span className="text-right">勝率</span>
              <span className="text-right">複勝率</span>
              <span className="text-right">出走数</span>
            </div>
            {rows.map((row, i) => {
              const pct = maxWinRate > 0 ? Math.round((row.win_rate / maxWinRate) * 100) : 0
              return (
                <div
                  key={row.jockey_id}
                  className="grid grid-cols-[2.5rem_1fr_5rem_5rem_4rem] gap-x-3 px-4 py-3 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <span className={`text-sm font-bold ${i < 3 ? 'text-indigo-500' : 'text-gray-300'}`}>{i + 1}</span>
                  <div>
                    <Link href={`/jockey/${row.jockey_id}`} className="text-sm font-semibold text-gray-900 hover:text-indigo-600 truncate">
                      {row.name}
                    </Link>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full w-full">
                      <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-right text-sm font-mono font-bold text-indigo-600">
                    {row.win_rate.toFixed(1)}%
                  </span>
                  <span className="text-right text-sm font-mono text-gray-600">
                    {row.top3_rate.toFixed(1)}%
                  </span>
                  <span className="text-right text-xs text-gray-400">{row.race_count}走</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
