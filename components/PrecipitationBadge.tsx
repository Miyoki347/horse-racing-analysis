import { TRACK_CONDITION_LABEL } from '@/types/race'

interface Props {
  precipMm: number | null
  prevDayMm: number | null
  precip7dayMm: number | null
  actualCondition: number
  estimatedCondition: number | null
}

const TRACK_COLOR: Record<string, string> = {
  '良':   'bg-green-100 text-green-800',
  '稍重': 'bg-yellow-100 text-yellow-800',
  '重':   'bg-orange-100 text-orange-800',
  '不良': 'bg-red-100 text-red-800',
}

export function PrecipitationBadge({ precipMm, prevDayMm, precip7dayMm, actualCondition, estimatedCondition }: Props) {
  if (precipMm == null) return null

  const actualLabel    = TRACK_CONDITION_LABEL[actualCondition] ?? '良'
  const estimatedLabel = estimatedCondition != null ? TRACK_CONDITION_LABEL[estimatedCondition] : null
  const matched        = estimatedCondition === actualCondition

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-sky-700 mb-3">🌧️ 当日降水量データ</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-xs text-gray-400 block">当日降水量</span>
          <span className="font-mono font-semibold text-gray-800">{precipMm.toFixed(1)} mm</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block">前日降水量</span>
          <span className="font-mono font-semibold text-gray-800">
            {prevDayMm != null ? `${prevDayMm.toFixed(1)} mm` : '-'}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block">7日間累積</span>
          <span className="font-mono font-semibold text-gray-800">
            {precip7dayMm != null ? `${precip7dayMm.toFixed(1)} mm` : '-'}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block">実際の馬場</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${TRACK_COLOR[actualLabel]}`}>
            {actualLabel}
          </span>
        </div>
      </div>
      {estimatedLabel && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">降水量から推定:</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${TRACK_COLOR[estimatedLabel]}`}>
            {estimatedLabel}
            <span className="ml-1">{matched ? '✓' : '△'}</span>
          </span>
          {!matched && (
            <span className="text-xs text-gray-400">
              ※ 推定と実際が異なります（排水設備・前週天候等の影響）
            </span>
          )}
        </div>
      )}
    </div>
  )
}
