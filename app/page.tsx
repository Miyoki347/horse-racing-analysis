import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GradeBadge } from '@/components/GradeBadge'
import type { Race } from '@/types/race'

const TRACK_CONDITION = ['良', '稍重', '重', '不良']

const GRADES = ['G1', 'G2', 'G3', 'L', 'OP'] as const
type Grade = typeof GRADES[number]

async function getRaces(grade?: string): Promise<Race[]> {
  let query = supabase
    .from('races')
    .select('*')
    .order('date', { ascending: false })
    .limit(100)

  if (grade && grade !== 'all') {
    query = query.eq('grade', grade)
  }

  const { data, error } = await query
  if (error) { console.error(error); return [] }
  return data ?? []
}

interface HomeProps {
  searchParams: Promise<{ grade?: string }>
}

export default async function HomePage({ searchParams }: HomeProps) {
  const { grade } = await searchParams
  const activeGrade = GRADES.includes(grade as Grade) ? grade : undefined
  const races = await getRaces(activeGrade)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">🏇 競馬AI分析</h1>
          <p className="mt-1 text-sm text-gray-500">JRA重賞データに基づくデータサイエンス指向の展開分析</p>
        </div>

        {/* メインナビ */}
        <div className="flex gap-2 mb-5">
          <span className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white">
            過去レース
          </span>
          <Link
            href="/upcoming"
            className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            🗓️ 出走予定
          </Link>
        </div>

        {/* グレードフィルター */}
        <div className="flex gap-2 flex-wrap mb-5">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              !activeGrade
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            全て
          </Link>
          {GRADES.map((g) => (
            <Link
              key={g}
              href={`/?grade=${g}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activeGrade === g
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {g}
            </Link>
          ))}
        </div>

        {/* 件数表示 */}
        <p className="text-xs text-gray-400 mb-3">
          {activeGrade ? `${activeGrade}` : '全グレード'} — {races.length}件表示
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
