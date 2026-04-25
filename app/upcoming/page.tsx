import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GradeBadge } from '@/components/GradeBadge'
import { SiteHeader } from '@/components/SiteHeader'
import type { UpcomingEntry } from '@/types/upcoming'

async function getUpcomingRaces() {
  const { data } = await supabase
    .from('upcoming_entries')
    .select('netkeiba_race_id, race_name, race_date, course, distance, track_type, grade')
    .order('race_date', { ascending: true })

  if (!data) return []

  // race_idでユニーク化
  const seen = new Set<string>()
  return data.filter((r: Partial<UpcomingEntry>) => {
    if (seen.has(r.netkeiba_race_id!)) return false
    seen.add(r.netkeiba_race_id!)
    return true
  })
}

export default async function UpcomingPage() {
  const races = await getUpcomingRaces()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <SiteHeader active="upcoming" />

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">出走予定レース</h2>
          <p className="text-sm text-gray-500">過去データに基づく予測ランキング</p>
        </div>

        {races.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>出走予定データがありません。</p>
            <p className="text-sm mt-2 font-mono">python fetch_upcoming.py</p>
            <p className="text-sm text-gray-400">を実行してデータを取得してください。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {races.map((race) => (
              <Link
                key={race.netkeiba_race_id}
                href={`/upcoming/${race.netkeiba_race_id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <GradeBadge grade={race.grade} />
                      <span className="font-semibold text-gray-900 truncate">{race.race_name}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>📅 {race.race_date}</span>
                      <span>📍 {race.course}</span>
                      <span>{race.track_type} {race.distance}m</span>
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
