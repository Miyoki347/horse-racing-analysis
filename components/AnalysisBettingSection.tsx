'use client'
import { useState, useCallback } from 'react'
import { AnalysisPanel } from './AnalysisPanel'
import { BettingPatternCard } from './BettingPatternCard'
import type { HorseWithHistory } from '@/types/upcoming'
import type { WeatherResult } from '@/lib/weather'

interface Props {
  raceId: string
  horses: HorseWithHistory[]
  weather: WeatherResult | null
}

export function AnalysisBettingSection({ raceId, horses, weather }: Props) {
  const [analysisText, setAnalysisText] = useState('')

  const handleStreamComplete = useCallback((text: string) => {
    setAnalysisText(text)
  }, [])

  return (
    <>
      {/* AI展開分析 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-1">🤖 AI展開分析</h2>
        <p className="text-xs text-gray-400 mb-4">
          天気・馬場推定・過去データを統合した客観的な展開分析です。
        </p>
        <AnalysisPanel
          raceId={raceId}
          isUpcoming
          horses={horses}
          weather={weather}
          onStreamComplete={handleStreamComplete}
        />
      </div>

      {/* 馬券の買い方3パターン */}
      <BettingPatternCard horses={horses} analysisText={analysisText || undefined} />
    </>
  )
}
