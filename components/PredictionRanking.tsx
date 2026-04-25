import type { RaceResult } from '@/types/race'

interface Props {
  results: RaceResult[]
}

const RANK_STYLE = [
  'bg-yellow-400 text-yellow-900',  // 1位
  'bg-gray-300 text-gray-800',      // 2位
  'bg-amber-600 text-white',        // 3位
]

export function PredictionRanking({ results }: Props) {
  const hasPastResults = results.some((r) => r.finish_position != null)

  const ranked = [...results]
    .filter((r) => r.time_index != null)
    .sort((a, b) => (b.time_index ?? 0) - (a.time_index ?? 0))
    .slice(0, 5)

  if (ranked.length === 0) return null

  const maxIndex = ranked[0].time_index ?? 100

  return (
    <div className="space-y-2">
      {hasPastResults && (
        <p className="text-xs text-gray-400">※ タイム指数による予測順位。括弧内は実際の着順。</p>
      )}
      {ranked.map((r, i) => {
        const pct = Math.round(((r.time_index ?? 0) / maxIndex) * 100)
        const badgeStyle = RANK_STYLE[i] ?? 'bg-gray-100 text-gray-600'

        return (
          <div key={r.id} className="flex items-center gap-3">
            {/* 順位バッジ */}
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeStyle}`}>
              {i + 1}
            </span>

            {/* 馬名・騎手 */}
            <div className="w-32 flex-shrink-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{r.horses?.name ?? '-'}</p>
              <p className="text-xs text-gray-400 truncate">{r.jockeys?.name ?? '-'}</p>
            </div>

            {/* タイム指数バー */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-700 w-10 text-right flex-shrink-0">
                  {r.time_index?.toFixed(1)}
                </span>
              </div>
              <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                <span>上がり {r.last_3f_time ?? '-'}秒</span>
                {r.odds != null && <span>{r.odds}倍</span>}
              </div>
            </div>

            {/* 実際の着順（過去レースのみ） */}
            {hasPastResults && (
              <span className={`w-8 text-center text-xs font-bold flex-shrink-0 ${
                r.finish_position === 1 ? 'text-yellow-600' :
                r.finish_position === 2 ? 'text-gray-500' :
                r.finish_position === 3 ? 'text-amber-700' : 'text-gray-400'
              }`}>
                ({r.finish_position ?? '-'})
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
