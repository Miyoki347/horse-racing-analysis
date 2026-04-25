'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { RaceResult } from '@/types/race'

interface Props {
  results: RaceResult[]
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
                 '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1']

export function TimeIndexChart({ results }: Props) {
  const sorted = [...results]
    .filter((r) => r.time_index != null)
    .sort((a, b) => (b.time_index ?? 0) - (a.time_index ?? 0))
    .slice(0, 10)

  const data = sorted.map((r) => ({
    name: r.horses?.name?.slice(0, 6) ?? '不明',
    value: r.time_index ?? 0,
    fullName: r.horses?.name ?? '不明',
    pos: r.finish_position,
  }))

  const minVal = Math.min(...data.map((d) => d.value))
  const domain: [number, number] = [Math.max(minVal - 0.5, 97), 100.5]

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <XAxis type="number" domain={domain} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={64} />
          <Tooltip
            formatter={(v) => [(v as number).toFixed(1), 'タイム指数']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
