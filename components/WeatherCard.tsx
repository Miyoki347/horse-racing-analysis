import type { WeatherResult } from '@/lib/weather'

interface Props {
  weather: WeatherResult
}

const TRACK_COLOR: Record<string, string> = {
  '良':   'bg-green-100 text-green-800 border-green-300',
  '稍重': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  '重':   'bg-orange-100 text-orange-800 border-orange-300',
  '不良': 'bg-red-100 text-red-800 border-red-300',
}

const WEATHER_ICON: Record<string, string> = {
  '快晴': '☀️', '晴れ': '🌤️', '曇り': '☁️',
  '霧': '🌫️', '霧雨': '🌦️', '雨': '🌧️',
  '雪/みぞれ': '🌨️', 'にわか雨': '🌦️', '雷雨': '⛈️',
}

export function WeatherCard({ weather }: Props) {
  const { raceDay, prevDay, precip7dayMm, trackEstimate, trackNote, city } = weather
  const icon = WEATHER_ICON[raceDay.label] ?? '🌡️'
  const trackStyle = TRACK_COLOR[trackEstimate] ?? 'bg-gray-100 text-gray-800 border-gray-300'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-800 mb-4">🌤️ 天気予報・推定馬場</h2>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* 当日天気 */}
        <div className="flex-1 bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">当日（{city}）</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{icon}</span>
            <span className="font-semibold text-gray-800">{raceDay.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <span className="text-gray-400 block">降水量</span>
              <span className="font-mono font-semibold">{raceDay.precipMm.toFixed(1)} mm</span>
            </div>
            <div>
              <span className="text-gray-400 block">気温</span>
              <span className="font-mono">{raceDay.tempMin.toFixed(0)}〜{raceDay.tempMax.toFixed(0)}℃</span>
            </div>
            <div>
              <span className="text-gray-400 block">最大風速</span>
              <span className="font-mono">{raceDay.windMax.toFixed(1)} m/s</span>
            </div>
          </div>
        </div>

        {/* 前日 + 7日間累積 */}
        <div className="flex-1 bg-gray-50 rounded-xl p-4 opacity-75">
          <p className="text-xs text-gray-400 mb-1">前日</p>
          {prevDay ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{WEATHER_ICON[prevDay.label] ?? '🌡️'}</span>
                <span className="text-sm text-gray-700">{prevDay.label}</span>
              </div>
              <div className="text-xs text-gray-600">
                <span className="text-gray-400 block">降水量</span>
                <span className="font-mono font-semibold">{prevDay.precipMm.toFixed(1)} mm</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400">データなし</p>
          )}
          <div className="mt-2 text-xs text-gray-600 border-t border-gray-200 pt-2">
            <span className="text-gray-400 block">7日間累積</span>
            <span className="font-mono font-semibold">{precip7dayMm.toFixed(1)} mm</span>
          </div>
        </div>

        {/* 推定馬場 */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-xs text-gray-400 mb-2">推定馬場状態</p>
          <div className={`rounded-xl border-2 px-4 py-3 text-center ${trackStyle}`}>
            <p className="text-2xl font-bold">{trackEstimate}</p>
            <p className="text-xs mt-1 opacity-75">（予測）</p>
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{trackNote}</p>
        </div>
      </div>
    </div>
  )
}
