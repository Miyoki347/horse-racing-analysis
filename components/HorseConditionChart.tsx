'use client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from 'recharts'

const CONDITION_LABELS = ['良', '稍重', '重', '不良']

export interface ConditionStat {
  track_condition: number
  win_rate: number
  top3_rate: number
  race_count: number
  avg_odds: number | null
}

interface Props {
  stats: ConditionStat[]
}

export function HorseConditionChart({ stats }: Props) {
  const data = CONDITION_LABELS.map((label, i) => {
    const s = stats.find((r) => r.track_condition === i)
    return {
      condition: label,
      win_rate:  s ? Math.round(s.win_rate * 100) : 0,
      top3_rate: s ? Math.round(s.top3_rate * 100) : 0,
      race_count: s?.race_count ?? 0,
    }
  })

  const hasAny = data.some((d) => d.race_count > 0)
  if (!hasAny) return null

  return (
    <div className="w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }} barGap={4}>
          <XAxis dataKey="condition" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={38} />
          <Tooltip
            formatter={(value, name) => [
              `${value}%`,
              name === 'win_rate' ? '勝率' : '複勝率',
            ]}
            labelFormatter={(label, payload) => {
              const count = payload?.[0]?.payload?.race_count ?? 0
              return `${label}（${count}走）`
            }}
          />
          <Legend formatter={(v) => (v === 'win_rate' ? '勝率' : '複勝率')} />
          <Bar dataKey="win_rate" fill="#6366f1" radius={[3, 3, 0, 0]}>
            <LabelList dataKey="win_rate" position="top" formatter={(v: unknown) => (Number(v) > 0 ? `${v}%` : '')} style={{ fontSize: 10, fill: '#6366f1' }} />
          </Bar>
          <Bar dataKey="top3_rate" fill="#34d399" radius={[3, 3, 0, 0]}>
            <LabelList dataKey="top3_rate" position="top" formatter={(v: unknown) => (Number(v) > 0 ? `${v}%` : '')} style={{ fontSize: 10, fill: '#34d399' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
