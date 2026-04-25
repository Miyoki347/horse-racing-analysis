'use client'
import type { SimConditions } from '@/app/api/simulate/route'

const DISTANCES = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2500, 3000, 3200]
const TRACK_TYPES = ['芝', 'ダート']
const TRACK_CONDITIONS = ['良', '稍重', '重', '不良']
const COURSES = ['東京', '中山', '阪神', '京都', '中京', '小倉', '函館', '札幌', '福島', '新潟']

interface Props {
  value: SimConditions
  onChange: (v: SimConditions) => void
}

export function ConditionSelector({ value, onChange }: Props) {
  const set = <K extends keyof SimConditions>(key: K, val: SimConditions[K]) =>
    onChange({ ...value, [key]: val })

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* 距離 */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">距離</label>
        <select
          value={value.distance}
          onChange={(e) => set('distance', Number(e.target.value))}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 bg-white"
        >
          {DISTANCES.map((d) => (
            <option key={d} value={d}>{d}m</option>
          ))}
        </select>
      </div>

      {/* 芝/ダート */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">芝/ダート</label>
        <div className="flex gap-1">
          {TRACK_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => set('track_type', t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                value.track_type === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 馬場状態 */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">馬場状態</label>
        <div className="flex gap-1">
          {TRACK_CONDITIONS.map((c, i) => (
            <button
              key={c}
              onClick={() => set('track_condition', i)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                value.track_condition === i
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 会場 */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">会場</label>
        <select
          value={value.course}
          onChange={(e) => set('course', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 bg-white"
        >
          {COURSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
