'use client'
import { useState, useCallback, useEffect } from 'react'
import type { HorseWithHistory } from '@/types/upcoming'
import type { WeatherResult } from '@/lib/weather'

interface Props {
  raceId: string
  isUpcoming?: boolean
  horses?: HorseWithHistory[]
  weather?: WeatherResult | null
}

interface PredictionCard {
  rank: number
  name: string
  reason: string
}

const PODIUM = [
  { label: '1着予想', bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-400 text-yellow-900', icon: '🥇' },
  { label: '2着予想', bg: 'bg-gray-50',   border: 'border-gray-300',   badge: 'bg-gray-300 text-gray-800',    icon: '🥈' },
  { label: '3着予想', bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-600 text-white',      icon: '🥉' },
]

function parseTop3(text: string): { cards: PredictionCard[]; rest: string } {
  const m = text.match(/\[TOP3\]([\s\S]*?)\[\/TOP3\]/)
  if (!m) return { cards: [], rest: text }

  const cards: PredictionCard[] = m[1]
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|')
      return {
        rank:   parseInt(parts[0] ?? '0', 10),
        name:   (parts[1] ?? '').trim(),
        reason: (parts[2] ?? '').trim(),
      }
    })
    .filter((c) => c.name && !isNaN(c.rank))

  const rest = text.replace(/\[TOP3\][\s\S]*?\[\/TOP3\]\n?/, '').trim()
  return { cards, rest }
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  if (parts.length === 1) return text
  return parts.map((p, j) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={j} className="font-bold text-gray-900">{p.slice(2, -2)}</strong>
      : p
  )
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## '))  return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-gray-800">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-gray-700">{line.slice(4)}</h3>
    if (line.startsWith('* ') || line.startsWith('- ')) {
      const body = line.slice(2)
      return <p key={i} className="pl-3 text-gray-700">・{renderInline(body)}</p>
    }
    if (line === '') return <br key={i} />
    return <p key={i} className="text-gray-700 leading-relaxed">{renderInline(line)}</p>
  })
}

export function AnalysisPanel({ raceId, isUpcoming = false, horses, weather }: Props) {
  const [rawText, setRawText]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [cards, setCards]         = useState<PredictionCard[]>([])
  const [analysisText, setAnalysisText] = useState('')

  // ストリーム完了後に [TOP3] ブロックをパース
  useEffect(() => {
    if (!loading && rawText) {
      const { cards: parsed, rest } = parseTop3(rawText)
      setCards(parsed)
      setAnalysisText(rest)
    }
  }, [loading, rawText])

  const generate = useCallback(async () => {
    setLoading(true)
    setRawText('')
    setCards([])
    setAnalysisText('')
    setError(null)

    try {
      const url = isUpcoming ? `/api/predict-upcoming/${raceId}` : `/api/predict/${raceId}`
      const res = await fetch(url, {
        method:  isUpcoming ? 'POST' : 'GET',
        headers: isUpcoming ? { 'Content-Type': 'application/json' } : undefined,
        body:    isUpcoming ? JSON.stringify({ horses, weather }) : undefined,
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setRawText((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [raceId, isUpcoming, horses])

  return (
    <div className="space-y-4">
      <button
        onClick={generate}
        disabled={loading}
        className="w-full min-h-[44px] px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold
                   hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50
                   disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <><span className="animate-spin text-lg">⟳</span>展開予想を生成中...</>
        ) : (
          '🤖 展開予想を生成（AI分析）'
        )}
      </button>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* 生成中はローテキストをそのまま薄く表示 */}
      {loading && rawText && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-sm animate-pulse whitespace-pre-wrap">
          {rawText.replace(/\[TOP3\][\s\S]*?\[\/TOP3\]\n?/, '')}
        </div>
      )}

      {/* 完了後: 予想カード + 分析テキスト */}
      {!loading && cards.length > 0 && (
        <>
          {/* 予想ポディウム */}
          <div className="grid grid-cols-3 gap-3">
            {cards.slice(0, 3).map((card) => {
              const style = PODIUM[card.rank - 1]
              return (
                <div
                  key={card.rank}
                  className={`rounded-xl border-2 p-3 text-center ${style.bg} ${style.border}`}
                >
                  <span className="text-2xl">{style.icon}</span>
                  <p className="text-xs text-gray-500 mt-1">{style.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">{card.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">{card.reason}</p>
                </div>
              )
            })}
          </div>

          {/* 分析テキスト */}
          {analysisText && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 prose prose-sm max-w-none">
              {renderMarkdown(analysisText)}
            </div>
          )}
        </>
      )}

      {/* 過去レース用（[TOP3]なし）フォールバック */}
      {!loading && cards.length === 0 && analysisText && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 prose prose-sm max-w-none">
          {renderMarkdown(analysisText)}
        </div>
      )}
    </div>
  )
}
