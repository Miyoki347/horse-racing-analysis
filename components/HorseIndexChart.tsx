'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface DataPoint {
  date: string
  index: number
  name: string
}

interface Props {
  data: DataPoint[]
}

export function HorseIndexChart({ data }: Props) {
  const values = data.map((d) => d.index)
  const min    = Math.min(...values)
  const max    = Math.max(...values)
  const avg    = values.reduce((s, v) => s + v, 0) / values.length

  return (
    <div className="w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[Math.max(min - 1, 94), max + 1]} tick={{ fontSize: 11 }} width={36} />
          <Tooltip
            formatter={(v) => [(v as number).toFixed(1), 'タイム指数']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
          />
          <ReferenceLine
            y={avg}
            stroke="#94a3b8"
            strokeDasharray="3 3"
            label={{ value: `平均${avg.toFixed(1)}`, fontSize: 10, fill: '#94a3b8', position: 'right' }}
          />
          <Line
            type="monotone"
            dataKey="index"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
