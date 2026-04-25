'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { HorseSearch } from '@/components/HorseSearch'
import { ConditionSelector } from '@/components/ConditionSelector'
import { HistoryBasedRanking } from '@/components/HistoryBasedRanking'
import type { HorseWithHistory } from '@/types/upcoming'
import type { SimConditions } from '@/app/api/simulate/route'

interface Horse { id: string; name: string }

const DEFAULT_CONDITIONS: SimConditions = {
  distance:        2000,
  track_type:      '芝',
  track_condition: 0,
  course:          '東京',
}

function parseTop3(text: string) {
  const m = text.match(/\[TOP3\]([\s\S]*?)\[\/TOP3\]/)
  if (!m) return { cards: [], rest: text }
  const cards = m[1].trim().split('\n').filter(Boolean).map((line) => {
    const [rank, name, reason] = line.split('|')
    return { rank: parseInt(rank ?? '0'), name: (name ?? '').trim(), reason: (reason ?? '').trim() }
  }).filter((c) => c.name)
  return { cards, rest: text.replace(/\[TOP3\][\s\S]*?\[\/TOP3\]\n?/, '').trim() }
}

const PODIUM = [
  { label: '1着予想', bg: 'bg-yellow-50', border: 'border-yellow-300', icon: '🥇' },
  { label: '2着予想', bg: 'bg-gray-50',   border: 'border-gray-300',   icon: '🥈' },
  { label: '3着予想', bg: 'bg-amber-50',  border: 'border-amber-300',  icon: '🥉' },
]

function renderMd(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## '))  return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-gray-800">{line.slice(3)}</h2>
    if (line.startsWith('- '))   return <p key={i} className="pl-3 text-gray-700">{line}</p>
    if (line === '')              return <br key={i} />
    return <p key={i} className="text-gray-700 leading-relaxed">{line}</p>
  })
}

export default function SimulatePage() {
  const [selectedHorses, setSelectedHorses] = useState<Horse[]>([])
  const [conditions, setConditions]         = useState<SimConditions>(DEFAULT_CONDITIONS)
  const [result, setResult]                 = useState<HorseWithHistory[] | null>(null)
  const [simLoading, setSimLoading]         = useState(false)

  // AI分析
  const [analysisRaw, setAnalysisRaw]   = useState('')
  const [aiLoading, setAiLoading]       = useState(false)
  const [aiError, setAiError]           = useState<string | null>(null)
  const [cards, setCards]               = useState<{ rank: number; name: string; reason: string }[]>([])
  const [analysisText, setAnalysisText] = useState('')

  const simulate = async () => {
    if (selectedHorses.length < 2) return
    setSimLoading(true)
    setResult(null)
    setAnalysisRaw('')
    setCards([])
    setAnalysisText('')
    setAiError(null)

    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horseIds: selectedHorses.map((h) => h.id), conditions }),
    })
    const data: HorseWithHistory[] = await res.json()
    setResult(data)
    setSimLoading(false)
  }

  const generateAnalysis = useCallback(async () => {
    if (!result) return
    setAiLoading(true)
    setAnalysisRaw('')
    setCards([])
    setAnalysisText('')
    setAiError(null)

    try {
      const res = await fetch('/api/simulate-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horses: result, conditions }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setAnalysisRaw(full)
      }
      const { cards: parsed, rest } = parseTop3(full)
      setCards(parsed)
      setAnalysisText(rest)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setAiLoading(false)
    }
  }, [result, conditions])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ヘッダー・ナビ */}
        <div>
          <div className="flex gap-2 mb-4">
            <Link href="/"        className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">過去レース</Link>
            <Link href="/upcoming" className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">🗓️ 出走予定</Link>
            <span className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white">🔬 シミュレーター</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">カスタムレースシミュレーター</h1>
          <p className="text-sm text-gray-500 mt-1">好きな馬を選んで、条件を設定して予測する</p>
        </div>

        {/* 馬選択 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">🐴 出走馬を選択</h2>
          <HorseSearch selected={selectedHorses} onChange={setSelectedHorses} />
        </div>

        {/* 条件設定 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">⚙️ レース条件</h2>
          <ConditionSelector value={conditions} onChange={setConditions} />
        </div>

        {/* 予測ボタン */}
        <button
          onClick={simulate}
          disabled={selectedHorses.length < 2 || simLoading}
          className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold text-base
                     hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50
                     disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {simLoading ? (
            <><span className="animate-spin">⟳</span>予測中...</>
          ) : (
            `🔬 予測する（${selectedHorses.length}頭）`
          )}
        </button>

        {selectedHorses.length < 2 && (
          <p className="text-xs text-center text-gray-400">2頭以上選択してください</p>
        )}

        {/* 予測結果 */}
        {result && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-1">🏆 予測ランキング</h2>
              <p className="text-xs text-gray-400 mb-4">
                {conditions.course} {conditions.distance}m {conditions.track_type}（{'良稍重重不良'.split('')[conditions.track_condition ?? 0]}）での条件別タイム指数平均
              </p>
              <HistoryBasedRanking horses={result} />
            </div>

            {/* AI分析 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-1">🤖 AI展開分析</h2>
              <p className="text-xs text-gray-400 mb-4">設定条件・各馬の過去成績・騎手特性を統合した展開予測</p>

              <button
                onClick={generateAnalysis}
                disabled={aiLoading}
                className="w-full min-h-[44px] px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold
                           hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50
                           disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {aiLoading ? <><span className="animate-spin">⟳</span>生成中...</> : '🤖 展開予想を生成（AI分析）'}
              </button>

              {aiError && (
                <div className="mt-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{aiError}</div>
              )}

              {/* 生成中プレビュー */}
              {aiLoading && analysisRaw && (
                <div className="mt-3 p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-sm animate-pulse whitespace-pre-wrap">
                  {analysisRaw.replace(/\[TOP3\][\s\S]*?\[\/TOP3\]\n?/, '')}
                </div>
              )}

              {/* 完了後: 予想カード + テキスト */}
              {!aiLoading && cards.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {cards.slice(0, 3).map((card) => {
                      const s = PODIUM[card.rank - 1]
                      return (
                        <div key={card.rank} className={`rounded-xl border-2 p-3 text-center ${s.bg} ${s.border}`}>
                          <span className="text-2xl">{s.icon}</span>
                          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                          <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">{card.name}</p>
                          <p className="text-xs text-gray-500 mt-1 leading-tight">{card.reason}</p>
                        </div>
                      )
                    })}
                  </div>
                  {analysisText && (
                    <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200 prose prose-sm max-w-none">
                      {renderMd(analysisText)}
                    </div>
                  )}
                </>
              )}

              {/* TOP3なしフォールバック */}
              {!aiLoading && cards.length === 0 && analysisText && (
                <div className="mt-3 p-4 rounded-xl bg-gray-50 border border-gray-200 prose prose-sm max-w-none">
                  {renderMd(analysisText)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
