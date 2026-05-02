'use client'
import { useState, useMemo } from 'react'
import type { HorseWithHistory } from '@/types/upcoming'
import {
  buildBettingPatterns,
  parseBettingPatternReasons,
  type BettingPattern,
  type PatternType,
} from '@/lib/bettingPatterns'

interface Props {
  horses: HorseWithHistory[]
  analysisText?: string  // AnalysisPanel のストリーム完了テキスト（任意）
}

const PATTERN_STYLE: Record<
  PatternType,
  { tab: string; activeTab: string; badge: string; riskBg: string }
> = {
  honmei: {
    tab:       'text-blue-600 border-blue-500',
    activeTab: 'border-b-2 font-bold',
    badge:     'bg-blue-100 text-blue-700',
    riskBg:    'bg-blue-50 border-blue-200',
  },
  balance: {
    tab:       'text-indigo-600 border-indigo-500',
    activeTab: 'border-b-2 font-bold',
    badge:     'bg-indigo-100 text-indigo-700',
    riskBg:    'bg-indigo-50 border-indigo-200',
  },
  ana: {
    tab:       'text-orange-600 border-orange-500',
    activeTab: 'border-b-2 font-bold',
    badge:     'bg-orange-100 text-orange-700',
    riskBg:    'bg-orange-50 border-orange-200',
  },
}

const RISK_ICON: Record<PatternType, string> = {
  honmei:  '🟢',
  balance: '🟡',
  ana:     '🔴',
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function HorseChip({
  horse,
  label,
  maxScore,
}: {
  horse: HorseWithHistory
  label: string
  maxScore: number
}) {
  const score = horse.ml_score ?? 0
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        {horse.popularity != null && (
          <span className="text-xs text-gray-500">{horse.popularity}番人気</span>
        )}
      </div>
      <p className="text-sm font-bold text-gray-900 mt-1">{horse.horse_name}</p>
      {horse.jockey_name && (
        <p className="text-xs text-gray-500">{horse.jockey_name}</p>
      )}
      {score > 0 && <ScoreBar score={score} max={maxScore} />}
    </div>
  )
}

function PatternPanel({
  pattern,
  maxScore,
}: {
  pattern: BettingPattern
  maxScore: number
}) {
  const style = PATTERN_STYLE[pattern.type]

  return (
    <div className="space-y-4 pt-4">
      {/* 推奨馬券・リスク */}
      <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${style.riskBg}`}>
        <div className="flex items-center gap-2">
          <span>{RISK_ICON[pattern.type]}</span>
          <span className="text-sm font-semibold text-gray-800">{pattern.riskLabel}</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
          推奨: {pattern.betType}
        </span>
      </div>

      {/* 軸馬 */}
      {pattern.axisHorses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">軸馬</p>
          <div className="grid grid-cols-1 gap-2">
            {pattern.axisHorses.map((h) => (
              <HorseChip key={h.id} horse={h} label="◎ 軸" maxScore={maxScore} />
            ))}
          </div>
        </div>
      )}

      {/* 相手馬 */}
      {pattern.targetHorses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">相手馬</p>
          <div className="grid grid-cols-2 gap-2">
            {pattern.targetHorses.map((h, i) => (
              <HorseChip
                key={h.id}
                horse={h}
                label={`▲ 相手${i + 1}`}
                maxScore={maxScore}
              />
            ))}
          </div>
        </div>
      )}

      {/* 根拠テキスト */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">根拠</p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {pattern.aiReason ?? pattern.reason}
        </p>
      </div>
    </div>
  )
}

export function BettingPatternCard({ horses, analysisText }: Props) {
  const [activeTab, setActiveTab] = useState<PatternType>('honmei')

  const patterns = useMemo(() => {
    const base = buildBettingPatterns(horses)
    if (!analysisText) return base

    const aiReasons = parseBettingPatternReasons(analysisText)
    return base.map((p) => ({
      ...p,
      aiReason: aiReasons[p.type] ?? p.reason,
    }))
  }, [horses, analysisText])

  const maxScore = useMemo(
    () => Math.max(...horses.map((h) => h.ml_score ?? 0), 1),
    [horses],
  )

  const activePattern = patterns.find((p) => p.type === activeTab)

  // ml_score が全員 null の場合は非表示
  if (horses.every((h) => h.ml_score == null)) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-800 mb-1">🎯 馬券の買い方</h2>
      <p className="text-xs text-gray-400 mb-4">
        MLスコアをもとに3パターンの買い方を提案します。
      </p>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-0">
        {patterns.map((p) => {
          const style = PATTERN_STYLE[p.type]
          const isActive = activeTab === p.type
          return (
            <button
              key={p.type}
              onClick={() => setActiveTab(p.type)}
              className={`flex-1 min-h-[44px] text-sm px-2 py-2.5 transition-colors
                ${style.tab}
                ${isActive ? style.activeTab : 'text-gray-400 border-b-2 border-transparent'}
              `}
            >
              {RISK_ICON[p.type]} {p.label}
            </button>
          )
        })}
      </div>

      {activePattern && (
        <PatternPanel pattern={activePattern} maxScore={maxScore} />
      )}
    </div>
  )
}
