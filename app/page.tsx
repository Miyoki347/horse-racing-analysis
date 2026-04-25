import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GradeBadge } from '@/components/GradeBadge'
import type { Race } from '@/types/race'

const TRACK_CONDITION = ['良', '稍重', '重', '不良']
const GRADES   = ['G1', 'G2', 'G3', 'L', 'OP'] as const
const YEARS    = ['2025', '2024', '2023', '2022'] as const
const COURSES  = ['東京', '中山', '阪神', '京都', '中京', '小倉', '函館', '札幌', '福島', '新潟'] as const

type Grade  = typeof GRADES[number]
type Year   = typeof YEARS[number]
type Course = typeof COURSES[number]

interface Filters {
  grade?:  string
  year?:   string
  course?: string
}

async function getRaces({ grade, year, course }: Filters): Promise<Race[]> {
  let query = supabase
    .from('races')
    .select('*')
    .order('date', { ascending: false })
    .limit(100)

  if (grade)  query = query.eq('grade', grade)
  if (year)   query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
  if (course) query = query.eq('course', course)

  const { data, error } = await query
  if (error) { console.error(error); return [] }
  return data ?? []
}

// 現在のフィルターを保持しつつ1つだけ変更したURLを生成
function filterHref(current: Filters, key: keyof Filters, value: string | undefined): string {
  const p = new URLSearchParams()
  const next = { ...current, [key]: value }
  if (next.grade)  p.set('grade', next.grade)
  if (next.year)   p.set('year', next.year)
  if (next.course) p.set('course', next.course)
  const qs = p.toString()
  return qs ? `/?${qs}` : '/'
}

interface HomeProps {
  searchParams: Promise<{ grade?: string; year?: string; course?: string }>
}

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams
  const activeGrade  = GRADES.includes(sp.grade as Grade)   ? sp.grade  : undefined
  const activeYear   = YEARS.includes(sp.year as Year)       ? sp.year   : undefined
  const activeCourse = COURSES.includes(sp.course as Course) ? sp.course : undefined

  const filters: Filters = { grade: activeGrade, year: activeYear, course: activeCourse }
  const races = await getRaces(filters)

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
      active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
    }`

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">🏇 競馬AI分析</h1>
          <p className="mt-1 text-sm text-gray-500">JRA重賞データに基づくデータサイエンス指向の展開分析</p>
        </div>

        {/* メインナビ */}
        <div className="flex gap-2 flex-wrap mb-5">
          <span className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white">過去レース</span>
          <Link href="/upcoming" className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">🗓️ 出走予定</Link>
          <Link href="/simulate" className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">🔬 シミュレーター</Link>
        </div>

        {/* フィルターパネル */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 space-y-3">

          {/* グレード */}
          <div>
            <p className="text-xs text-gray-400 mb-2">グレード</p>
            <div className="flex gap-2 flex-wrap">
              <Link href={filterHref(filters, 'grade', undefined)} className={pill(!activeGrade)}>全て</Link>
              {GRADES.map((g) => (
                <Link key={g} href={filterHref(filters, 'grade', activeGrade === g ? undefined : g)} className={pill(activeGrade === g)}>{g}</Link>
              ))}
            </div>
          </div>

          {/* 年 */}
          <div>
            <p className="text-xs text-gray-400 mb-2">年</p>
            <div className="flex gap-2 flex-wrap">
              <Link href={filterHref(filters, 'year', undefined)} className={pill(!activeYear)}>全年</Link>
              {YEARS.map((y) => (
                <Link key={y} href={filterHref(filters, 'year', activeYear === y ? undefined : y)} className={pill(activeYear === y)}>{y}</Link>
              ))}
            </div>
          </div>

          {/* 会場 */}
          <div>
            <p className="text-xs text-gray-400 mb-2">会場</p>
            <div className="flex gap-2 flex-wrap">
              <Link href={filterHref(filters, 'course', undefined)} className={pill(!activeCourse)}>全会場</Link>
              {COURSES.map((c) => (
                <Link key={c} href={filterHref(filters, 'course', activeCourse === c ? undefined : c)} className={pill(activeCourse === c)}>{c}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* 件数 */}
        <p className="text-xs text-gray-400 mb-3">
          {[activeGrade, activeYear ? `${activeYear}年` : null, activeCourse].filter(Boolean).join(' / ') || '全件'}
          {' — '}{races.length}件表示
        </p>

        {races.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>該当するレースがありません。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {races.map((race) => (
              <Link
                key={race.id}
                href={`/race/${race.netkeiba_race_id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <GradeBadge grade={race.grade} />
                      <span className="font-semibold text-gray-900 truncate">{race.race_name}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>📅 {race.date}</span>
                      <span>📍 {race.course}</span>
                      <span>{race.track_type} {race.distance}m</span>
                      <span>馬場:{TRACK_CONDITION[race.track_condition] ?? '良'}</span>
                      {race.weather && <span>天候:{race.weather}</span>}
                    </div>
                  </div>
                  <span className="text-gray-400 text-lg flex-shrink-0">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
