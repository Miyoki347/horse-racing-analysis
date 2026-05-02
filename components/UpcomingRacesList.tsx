'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GradeBadge } from '@/components/GradeBadge'
import type { UpcomingEntry } from '@/types/upcoming'

type RaceSummary = Pick<
  UpcomingEntry,
  'netkeiba_race_id' | 'race_name' | 'race_date' | 'course' | 'distance' | 'track_type' | 'grade'
>

function RaceCard({ race }: { race: RaceSummary }) {
  return (
    <Link
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
  )
}

interface Props {
  races: RaceSummary[]
  today: string
}

export function UpcomingRacesList({ races, today }: Props) {
  const [pastOpen, setPastOpen] = useState(false)

  const pastRaces = races.filter(r => r.race_date < today).reverse()
  const upcomingRaces = races.filter(r => r.race_date >= today)

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-800">出走予定レース</h2>
          <p className="text-sm text-gray-500">過去データに基づく予測ランキング</p>
        </div>
        {upcomingRaces.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>出走予定データがありません。</p>
            <p className="text-sm mt-2 font-mono">python fetch_upcoming.py</p>
            <p className="text-sm text-gray-400">を実行してデータを取得してください。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingRaces.map(race => (
              <RaceCard key={race.netkeiba_race_id} race={race} />
            ))}
          </div>
        )}
      </section>

      {pastRaces.length > 0 && (
        <section>
          <button
            onClick={() => setPastOpen(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-2"
          >
            <span className={`inline-block transition-transform duration-200 ${pastOpen ? 'rotate-90' : ''}`}>▶</span>
            過去レース（{pastRaces.length}件）
          </button>
          {pastOpen && (
            <div className="space-y-3 mt-2 opacity-70">
              {pastRaces.map(race => (
                <RaceCard key={race.netkeiba_race_id} race={race} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
