'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { SiteHeader } from '@/components/SiteHeader'
import { GradeBadge } from '@/components/GradeBadge'

// ---- 型 ----
type Summary = {
  races: number; wins: number; hit_rate: string
  total_invested: number; total_return: number; roi: string
}

type TimelineEntry = {
  date: string; race_name: string; grade: string | null
  netkeiba_race_id: string | null
  hit: boolean; gain: number; net: number
  odds: number | null; cumulative: number
}

type BacktestResult = { summary: Summary; bet: number; timeline: TimelineEntry[] }

// ---- 設定オプション ----
const RANK_OPTIONS  = [{ v: 1, label: '1位' }, { v: 2, label: '2位' }, { v: 3, label: '3位' }]
const GRADE_OPTIONS = [
  { v: 'g1',   label: 'G1のみ' },
  { v: 'g1g2', label: 'G1+G2' },
  { v: 'g3',   label: 'G3以上' },
  { v: 'all',  label: '全重賞' },
]
const BET_OPTIONS = [{ v: 100, label: '¥100' }, { v: 500, label: '¥500' }, { v: 1000, label: '¥1,000' }]

// ---- チャート tooltip ----
function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: TimelineEntry & { bet: number } }[] }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-md text-xs max-w-[200px]">
      <p className="font-semibold text-gray-700 mb-1">{d.date}</p>
      <p className="text-gray-500 truncate mb-1">{d.race_name}</p>
      <p className={d.hit ? 'text-green-600 font-semibold' : 'text-red-500'}>
        {d.hit ? `的中 +¥${d.gain.toLocaleString()}` : `ハズレ`}
      </p>
      <p className="text-gray-500 mt-0.5">
        収支: <span className={d.net >= 0 ? 'text-green-600' : 'text-red-500'}>
          {d.net >= 0 ? '+' : ''}¥{d.net.toLocaleString()}
        </span>
      </p>
      <p className="text-gray-400 mt-0.5">
        累積: <span className={d.cumulative >= 0 ? 'text-green-600' : 'text-red-500'}>
          {d.cumulative >= 0 ? '+' : ''}¥{d.cumulative.toLocaleString()}
        </span>
      </p>
    </div>
  )
}

export default function BacktestPage() {
  const [rank,    setRank]    = useState(1)
  const [grade,   setGrade]   = useState('g1')
  const [bet,     setBet]     = useState(100)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<BacktestResult | null>(null)
  const [showAll, setShowAll] = useState(false)

  const pill = (active: boolean) =>
    `px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
    }`

  const run = async () => {
    setLoading(true)
    setResult(null)
    setShowAll(false)
    try {
      const res  = await fetch(`/api/backtest?rank=${rank}&grade=${grade}&bet=${bet}`)
      const data = await res.json()
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const roi     = result ? parseFloat(result.summary.roi) : 0
  const chartData = (result?.timeline ?? []).map((t) => ({ ...t, bet: result!.bet }))
  const tableRows = showAll ? chartData : chartData.slice(-30).reverse()
  const finalCumulative = result?.timeline.at(-1)?.cumulative ?? 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <SiteHeader active="backtest" />

        <div>
          <h2 className="text-xl font-bold text-gray-900">回収率バックテスト</h2>
          <p className="text-sm text-gray-500 mt-1">
            タイム指数上位馬に仮想ベットしたとき、過去の回収率はどうなるかをシミュレーションします
          </p>
        </div>

        {/* 戦略パネル */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-2">予測対象（タイム指数上位何位に賭けるか）</p>
            <div className="flex gap-2">
              {RANK_OPTIONS.map((o) => (
                <button key={o.v} onClick={() => setRank(o.v)} className={pill(rank === o.v)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">グレード絞り込み</p>
            <div className="flex gap-2 flex-wrap">
              {GRADE_OPTIONS.map((o) => (
                <button key={o.v} onClick={() => setGrade(o.v)} className={pill(grade === o.v)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">1レースあたり賭け金</p>
            <div className="flex gap-2">
              {BET_OPTIONS.map((o) => (
                <button key={o.v} onClick={() => setBet(o.v)} className={pill(bet === o.v)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 実行ボタン */}
        <button
          onClick={run}
          disabled={loading}
          className="w-full min-h-[52px] rounded-xl bg-indigo-600 text-white font-semibold text-base
                     hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60
                     disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <><span className="animate-spin text-xl">⟳</span>シミュレーション中...</>
          ) : (
            '📊 シミュレーション開始'
          )}
        </button>

        {/* 注記 */}
        <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">
          ⚠️ タイム指数は当該レースの走破タイムから算出されるため、このシミュレーションは「指数の傾向確認」として解釈してください。真の予測精度の検証は LightGBM モデル完成後に行います。
        </p>

        {/* 結果 */}
        {result && (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: '対象レース数', value: `${result.summary.races}件` },
                { label: '的中数',       value: `${result.summary.wins}勝` },
                { label: '的中率',       value: `${result.summary.hit_rate}%` },
                { label: '総投資額',     value: `¥${result.summary.total_invested.toLocaleString()}` },
                { label: '総回収額',     value: `¥${result.summary.total_return.toLocaleString()}` },
                {
                  label: 'ROI',
                  value: `${roi >= 0 ? '+' : ''}${result.summary.roi}%`,
                  color: roi >= 0 ? 'text-green-600' : 'text-red-500',
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* 累積収益グラフ */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-gray-800">📈 累積収益推移</h2>
                <span className={`text-sm font-bold ${finalCumulative >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {finalCumulative >= 0 ? '+' : ''}¥{finalCumulative.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v.slice(2, 7).replace('-', '/')}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={60}
                      tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366f1' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* レース別結果テーブル */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">
                  📋 レース別結果{showAll ? '' : `（直近30件）`}
                </h2>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {showAll ? '直近30件に絞る' : `全${result.timeline.length}件を表示`}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-400 border-b border-gray-100">
                    <tr>
                      {['日付', 'レース名', '結果', 'オッズ', '収支', '累積'].map((h) => (
                        <th key={h} className="py-2 pr-4 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tableRows.map((r, i) => (
                      <tr key={i} className={r.hit ? 'bg-green-50' : ''}>
                        <td className="py-2 pr-4 text-gray-400 whitespace-nowrap text-xs">{r.date}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {r.grade && <GradeBadge grade={r.grade} />}
                            {r.netkeiba_race_id ? (
                              <Link href={`/race/${r.netkeiba_race_id}`} className="text-indigo-600 hover:underline text-xs">
                                {r.race_name}
                              </Link>
                            ) : (
                              <span className="text-xs">{r.race_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-center">
                          {r.hit ? (
                            <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">的中</span>
                          ) : (
                            <span className="text-xs text-gray-400">ハズレ</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-center text-xs font-mono text-gray-600">
                          {r.odds != null ? `${r.odds.toFixed(1)}倍` : '-'}
                        </td>
                        <td className={`py-2 pr-4 text-right text-xs font-mono font-semibold ${r.net >= 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {r.net >= 0 ? '+' : ''}¥{r.net.toLocaleString()}
                        </td>
                        <td className={`py-2 pr-4 text-right text-xs font-mono ${r.cumulative >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {r.cumulative >= 0 ? '+' : ''}¥{r.cumulative.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
