'use client'
import { useState } from 'react'
import type { HorseWithHistory } from '@/types/upcoming'

interface Props {
  horses: HorseWithHistory[]
}

const RANK_STYLE = [
  'bg-yellow-400 text-yellow-900',
  'bg-gray-300 text-gray-800',
  'bg-amber-600 text-white',
]

export function HistoryBasedRanking({ horses }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const ranked = [...horses].sort((a, b) => {
    if (a.avg_time_index == null && b.avg_time_index == null) return 0
    if (a.avg_time_index == null) return 1
    if (b.avg_time_index == null) return -1
    return b.avg_time_index - a.avg_time_index
  })

  const maxScore = ranked.find(h => h.avg_time_index != null)?.avg_time_index ?? 100

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">過去直近5走のタイム指数平均によるランキング。データ不足の馬は下位に表示。</p>
      {ranked.map((horse, i) => {
        const hasData  = horse.avg_time_index != null
        const pct      = hasData ? Math.round((horse.avg_time_index! / maxScore) * 100) : 0
        const badge    = RANK_STYLE[i] ?? 'bg-gray-100 text-gray-500'
        const isOpen   = expanded === horse.horse_name

        return (
          <div key={horse.horse_name} className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : horse.horse_name)}
            >
              {/* 順位バッジ */}
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge}`}>
                {i + 1}
              </span>

              {/* 馬番・馬名・騎手 */}
              <div className="w-36 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">#{horse.horse_number}</span>
                  <span className="text-sm font-semibold text-gray-900 truncate">{horse.horse_name}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">{horse.jockey_name ?? '-'}</p>
              </div>

              {/* スコアバー */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${hasData ? 'bg-indigo-500' : 'bg-gray-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-700 w-12 text-right flex-shrink-0">
                    {hasData ? horse.avg_time_index!.toFixed(1) : 'データなし'}
                  </span>
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  <span>最高 {horse.best_time_index?.toFixed(1) ?? '-'}</span>
                  <span>斤量 {horse.weight_carried ?? '-'}kg</span>
                  {horse.horse_weight && (
                    <span>
                      {horse.horse_weight}kg
                      {horse.horse_weight_change != null && (
                        <span className={horse.horse_weight_change > 0 ? 'text-red-400' : horse.horse_weight_change < 0 ? 'text-blue-400' : ''}>
                          {horse.horse_weight_change > 0 ? `+${horse.horse_weight_change}` : horse.horse_weight_change}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <span className={`text-gray-400 text-sm flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
            </button>

            {/* 過去成績 */}
            {isOpen && (
              <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                {horse.recent_results.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">過去データなし</p>
                ) : (
                  <div className="space-y-1 pt-2">
                    {horse.recent_results.map((r, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-20 flex-shrink-0">{r.date}</span>
                        <span className="text-gray-600 truncate flex-1">{r.race_name}</span>
                        <span className="text-gray-500 w-12 text-right flex-shrink-0">
                          {r.distance}m {r.track_type}
                        </span>
                        <span className={`w-8 text-right font-bold flex-shrink-0 ${
                          r.finish_position === 1 ? 'text-yellow-600' :
                          r.finish_position === 2 ? 'text-gray-500' :
                          r.finish_position === 3 ? 'text-amber-700' : 'text-gray-400'
                        }`}>
                          {r.finish_position ?? '-'}着
                        </span>
                        <span className="w-12 text-right text-indigo-600 font-mono flex-shrink-0">
                          {r.time_index?.toFixed(1) ?? '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
