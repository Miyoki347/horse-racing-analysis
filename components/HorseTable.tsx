'use client'
import Link from 'next/link'
import type { RaceResult } from '@/types/race'

interface Props {
  results: RaceResult[]
}

export function HorseTable({ results }: Props) {
  const sorted = [...results].sort(
    (a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99),
  )

  const winnerTime = sorted.find((r) => r.time_seconds)?.time_seconds ?? null

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
          <tr>
            {['着', '馬番', '馬名', '騎手', '斤量', 'タイム', '上3F', 'T指数', '人気', 'オッズ', '馬体重'].map((h) => (
              <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((r) => {
            const pos = r.finish_position
            const rowBg =
              pos === 1 ? 'bg-yellow-50' :
              pos === 2 ? 'bg-gray-50' :
              pos === 3 ? 'bg-orange-50' : 'bg-white'

            const timeDiff = winnerTime && r.time_seconds
              ? (r.time_seconds - winnerTime).toFixed(1)
              : null

            return (
              <tr key={r.id} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                <td className="px-3 py-3 font-bold text-center w-8">
                  {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos ?? '-'}
                </td>
                <td className="px-3 py-3 text-center">{r.horse_number}</td>
                <td className="px-3 py-3 font-medium whitespace-nowrap">
                  <Link href={`/horse/${encodeURIComponent(r.horses?.name ?? '')}`} className="text-indigo-600 hover:underline">
                    {r.horses?.name}
                  </Link>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-gray-600">{r.jockeys?.display_name ?? r.jockeys?.name}</td>
                <td className="px-3 py-3 text-center">{r.weight_carried}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {r.time_seconds
                    ? `${Math.floor(r.time_seconds / 60)}:${(r.time_seconds % 60).toFixed(1).padStart(4, '0')}`
                    : '-'}
                  {timeDiff && pos !== 1 && (
                    <span className="ml-1 text-xs text-gray-400">+{timeDiff}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">{r.last_3f_time ?? '-'}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-mono font-bold ${
                    (r.time_index ?? 0) >= 99.8 ? 'text-red-600' :
                    (r.time_index ?? 0) >= 99.5 ? 'text-orange-500' : 'text-gray-700'
                  }`}>
                    {r.time_index?.toFixed(1) ?? '-'}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">{r.popularity ?? '-'}</td>
                <td className="px-3 py-3 text-right">{r.odds ? `${r.odds}倍` : '-'}</td>
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  {r.horse_weight ?? '-'}
                  {r.horse_weight_change != null && (
                    <span className={`ml-1 text-xs ${r.horse_weight_change > 0 ? 'text-red-500' : r.horse_weight_change < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                      ({r.horse_weight_change > 0 ? '+' : ''}{r.horse_weight_change})
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
