'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { HorseWithHistory } from '@/types/upcoming'
import { calcDangerScore, isPopularHorse } from '@/lib/dangerScore'

interface Props {
  horses: HorseWithHistory[]
}

const RANK_STYLE = [
  'bg-yellow-400 text-yellow-900',
  'bg-gray-300 text-gray-800',
  'bg-amber-600 text-white',
]

type SortMode = 'time_index' | 'ml_score'
type ViewMode = 'card' | 'table'

// タイム指数の高低で色を返す（最高値比）
function indexColor(val: number, max: number): string {
  const ratio = max > 0 ? val / max : 0
  if (ratio >= 0.98) return 'text-indigo-700 font-bold'
  if (ratio >= 0.94) return 'text-indigo-500 font-semibold'
  if (ratio >= 0.88) return 'text-gray-700'
  return 'text-gray-400'
}

export function HistoryBasedRanking({ horses }: Props) {
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [sortMode, setSortMode]   = useState<SortMode>('time_index')
  const [viewMode, setViewMode]   = useState<ViewMode>('card')
  const [guideOpen, setGuideOpen] = useState(false)

  const hasML = horses.some(h => h.ml_score != null)

  const raceDistance  = horses[0]?.distance ?? 0
  const raceTrackType = horses[0]?.track_type ?? '芝'
  const dangerMap = new Map(
    horses.map(h => [h.horse_name, calcDangerScore(h, raceDistance, raceTrackType, horses)])
  )

  const ranked = [...horses].sort((a, b) => {
    if (sortMode === 'ml_score') {
      if (a.ml_score == null && b.ml_score == null) return 0
      if (a.ml_score == null) return 1
      if (b.ml_score == null) return -1
      return b.ml_score - a.ml_score
    }
    if (a.avg_time_index == null && b.avg_time_index == null) return 0
    if (a.avg_time_index == null) return 1
    if (b.avg_time_index == null) return -1
    return b.avg_time_index - a.avg_time_index
  })

  const maxScore = ranked.find(h => h.avg_time_index != null)?.avg_time_index ?? 100

  return (
    <div className="space-y-3">

      {/* 指標ガイド（折り畳み） */}
      <div className="rounded-lg border border-gray-100 bg-gray-50">
        <button
          onClick={() => setGuideOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
        >
          <span className="font-semibold">📖 指標の見方</span>
          <span className={`transition-transform text-gray-400 ${guideOpen ? 'rotate-90' : ''}`}>›</span>
        </button>
        {guideOpen && (
          <div className="px-3 pb-3 space-y-1 border-t border-gray-100 pt-2">
            <p className="text-xs text-gray-500"><span className="font-semibold text-indigo-600">📊 タイム指数</span> — 過去直近5走の補正済み平均。実績ベースの客観評価。</p>
            {hasML && <p className="text-xs text-gray-500"><span className="font-semibold text-green-600">🤖 AI複勝%</span> — LightGBMによる3着以内確率。タイム指数・騎手・ローテーション等を統合。</p>}
            <p className="text-xs text-gray-500"><span className="font-semibold text-red-600">⚠️ 危険人気</span> — 人気上位だがリスク要因を複数抱える馬。</p>
            <div className="border-t border-gray-200 mt-2 pt-2 space-y-0.5">
              <p className="text-xs font-semibold text-gray-600 mb-1">買い方ガイド</p>
              <p className="text-xs text-gray-500">🎯 <span className="font-medium">単勝</span> → タイム指数上位</p>
              <p className="text-xs text-gray-500">🎯 <span className="font-medium">複勝</span> → AI複勝%上位</p>
              <p className="text-xs text-gray-500">🎯 <span className="font-medium">馬連・ワイド</span> → 両方上位の馬を軸に</p>
            </div>
          </div>
        )}
      </div>

      {/* コントロールバー */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* 並び順 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">並び順:</span>
          <button
            onClick={() => setSortMode('time_index')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sortMode === 'time_index' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            📊 タイム指数
          </button>
          {hasML && (
            <button
              onClick={() => setSortMode('ml_score')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sortMode === 'ml_score' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              🤖 AI予測
            </button>
          )}
        </div>
        {/* ビュー切り替え */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('card')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${viewMode === 'card' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            ☰ カード
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >
            ⊞ テーブル
          </button>
        </div>
      </div>

      {/* ─── テーブルビュー ─── */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs min-w-[540px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">#</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">馬名 / 騎手</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">指数平均</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">最高</th>
                {hasML && <th className="px-3 py-2 text-right text-gray-500 font-medium">複勝%</th>}
                <th className="px-3 py-2 text-center text-gray-500 font-medium">直近3走</th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">フラグ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranked.map((horse, i) => {
                const badge   = RANK_STYLE[i] ?? 'bg-gray-100 text-gray-500'
                const danger  = dangerMap.get(horse.horse_name)
                const popular = isPopularHorse(horse, horses)
                const isDangerous = danger && danger.score >= 3 && popular

                const recent3 = horse.recent_results.slice(0, 3)
                  .map(r => r.finish_position ?? '-')

                return (
                  <tr key={horse.horse_name} className="hover:bg-gray-50 transition-colors">
                    {/* 順位 */}
                    <td className="px-3 py-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${badge}`}>
                        {i + 1}
                      </span>
                    </td>

                    {/* 馬名・騎手 */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">#{horse.horse_number}</span>
                        <Link
                          href={`/horse/${encodeURIComponent(horse.horse_name)}`}
                          className="font-semibold text-indigo-600 hover:underline"
                        >
                          {horse.horse_name}
                        </Link>
                      </div>
                      <p className="text-gray-400 mt-0.5">{horse.jockey_name ?? '-'}</p>
                    </td>

                    {/* タイム指数平均 */}
                    <td className="px-3 py-2.5 text-right">
                      {horse.avg_time_index != null ? (
                        <div>
                          <span className={`font-mono ${indexColor(horse.avg_time_index, maxScore)}`}>
                            {horse.avg_time_index.toFixed(1)}
                          </span>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full w-16 ml-auto">
                            <div
                              className="h-1.5 bg-indigo-400 rounded-full"
                              style={{ width: `${Math.round((horse.avg_time_index / maxScore) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 最高指数 */}
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-mono ${horse.best_time_index ? indexColor(horse.best_time_index, maxScore) : 'text-gray-300'}`}>
                        {horse.best_time_index?.toFixed(1) ?? '-'}
                      </span>
                    </td>

                    {/* AI複勝% */}
                    {hasML && (
                      <td className="px-3 py-2.5 text-right">
                        {horse.ml_score != null ? (
                          <span className={`font-mono font-semibold ${horse.ml_score >= 0.4 ? 'text-green-600' : horse.ml_score >= 0.25 ? 'text-green-500' : 'text-gray-400'}`}>
                            {(horse.ml_score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )}

                    {/* 直近3走 */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {recent3.length === 0 ? (
                          <span className="text-gray-300">-</span>
                        ) : (
                          recent3.map((pos, j) => (
                            <span
                              key={j}
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs
                                ${pos === 1 ? 'bg-yellow-100 text-yellow-700' :
                                  pos === 2 ? 'bg-gray-100 text-gray-600' :
                                  pos === 3 ? 'bg-amber-100 text-amber-700' :
                                  typeof pos === 'number' ? 'bg-gray-50 text-gray-400' : 'bg-gray-50 text-gray-300'}`}
                            >
                              {pos}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* フラグ */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {isDangerous && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-xs whitespace-nowrap">⚠️ 危険人気</span>
                        )}
                        {horse.is_jockey_changed && (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium text-xs whitespace-nowrap">乗替</span>
                        )}
                        {horse.rest_weeks != null && horse.rest_weeks >= 12 && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium text-xs whitespace-nowrap">休{horse.rest_weeks}週</span>
                        )}
                        {horse.horse_weight_change != null && Math.abs(horse.horse_weight_change) >= 8 && (
                          <span className={`px-1.5 py-0.5 rounded font-medium text-xs whitespace-nowrap ${horse.horse_weight_change < 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                            {horse.horse_weight_change > 0 ? '+' : ''}{horse.horse_weight_change}kg
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── カードビュー ─── */}
      {viewMode === 'card' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 text-xs text-gray-400">
            <span className="w-8 flex-shrink-0 text-center">順位</span>
            <span className="w-36 flex-shrink-0">馬番 / 馬名 / 騎手</span>
            <span className="flex-1 text-right pr-6">
              {sortMode === 'ml_score' ? 'AI複勝確率' : 'タイム指数平均'}
            </span>
          </div>
          {ranked.map((horse, i) => {
            const hasData = horse.avg_time_index != null
            const pct     = hasData ? Math.round((horse.avg_time_index! / maxScore) * 100) : 0
            const badge   = RANK_STYLE[i] ?? 'bg-gray-100 text-gray-500'
            const isOpen  = expanded === horse.horse_name

            return (
              <div key={horse.horse_name} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : horse.horse_name)}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge}`}>
                    {i + 1}
                  </span>

                  <div className="w-36 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">#{horse.horse_number}</span>
                      <Link
                        href={`/horse/${encodeURIComponent(horse.horse_name)}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {horse.horse_name}
                      </Link>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{horse.jockey_name ?? '-'}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            sortMode === 'ml_score'
                              ? (horse.ml_score != null ? 'bg-green-500' : 'bg-gray-300')
                              : (hasData ? 'bg-indigo-500' : 'bg-gray-300')
                          }`}
                          style={{ width: `${sortMode === 'ml_score' ? (horse.ml_score != null ? Math.round(horse.ml_score * 100) : 0) : pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-700 w-16 text-right flex-shrink-0">
                        {sortMode === 'ml_score'
                          ? (horse.ml_score != null ? `複勝${(horse.ml_score * 100).toFixed(0)}%` : '-')
                          : (hasData ? horse.avg_time_index!.toFixed(1) : 'データなし')}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <span className="text-xs text-gray-400">最高 {horse.best_time_index?.toFixed(1) ?? '-'}</span>
                      <span className="text-xs text-gray-400">斤量 {horse.weight_carried ?? '-'}kg</span>
                      {horse.horse_weight && (
                        <span className="text-xs text-gray-400">
                          {horse.horse_weight}kg
                          {horse.horse_weight_change != null && (
                            <span className={horse.horse_weight_change > 0 ? 'text-red-400' : horse.horse_weight_change < 0 ? 'text-blue-400' : ''}>
                              {horse.horse_weight_change > 0 ? `+${horse.horse_weight_change}` : horse.horse_weight_change}
                            </span>
                          )}
                        </span>
                      )}
                      {horse.rest_weeks != null && horse.rest_weeks >= 4 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${horse.rest_weeks >= 12 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                          {horse.rest_weeks >= 12 ? `休み明け${horse.rest_weeks}週` : `中${horse.rest_weeks}週`}
                        </span>
                      )}
                      {horse.ml_score != null && sortMode !== 'ml_score' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                          AI複勝{(horse.ml_score * 100).toFixed(0)}%
                        </span>
                      )}
                      {horse.is_jockey_changed && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">
                          乗り替わり
                        </span>
                      )}
                      {(() => {
                        const danger  = dangerMap.get(horse.horse_name)
                        const popular = isPopularHorse(horse, horses)
                        if (danger && danger.score >= 3 && popular) {
                          return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">⚠️ 危険人気</span>
                        }
                        return null
                      })()}
                      {horse.jockey_course_race_count != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                          コース勝率{horse.jockey_course_win_rate}%・複{horse.jockey_course_top3_rate}%({horse.jockey_course_race_count}走)
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={`text-gray-400 text-sm flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                    {(() => {
                      const danger = dangerMap.get(horse.horse_name)
                      if (!danger || danger.flags.length === 0) return null
                      return (
                        <div className="pt-2 pb-1">
                          <p className="text-xs text-red-600 font-medium">
                            ⚠️ リスク要因: {danger.flags.join('・')}（スコア: {danger.score}）
                          </p>
                        </div>
                      )
                    })()}
                    {horse.recent_results.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">過去データなし</p>
                    ) : (
                      <div className="space-y-1 pt-2">
                        {horse.recent_results.map((r, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400 w-20 flex-shrink-0">{r.date}</span>
                            <span className="text-gray-600 truncate flex-1">{r.race_name}</span>
                            <span className="text-gray-500 w-12 text-right flex-shrink-0">{r.distance}m {r.track_type}</span>
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
      )}
    </div>
  )
}
