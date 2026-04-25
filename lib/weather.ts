// Open-Meteo API — 無料・APIキー不要
// forecast: https://api.open-meteo.com/v1/forecast
// historical: https://archive-api.open-meteo.com/v1/archive

export const VENUE_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  '東京': { lat: 35.7399, lon: 139.5049, city: '府中市' },
  '中山': { lat: 35.7751, lon: 139.9194, city: '船橋市' },
  '阪神': { lat: 34.7333, lon: 135.3167, city: '宝塚市' },
  '京都': { lat: 34.9039, lon: 135.7556, city: '京都市' },
  '中京': { lat: 35.0928, lon: 136.8786, city: '名古屋市' },
  '小倉': { lat: 33.8436, lon: 130.8416, city: '北九州市' },
  '函館': { lat: 41.8122, lon: 140.7517, city: '函館市' },
  '札幌': { lat: 43.0583, lon: 141.3381, city: '札幌市' },
  '福島': { lat: 37.7600, lon: 140.4699, city: '福島市' },
  '新潟': { lat: 37.7667, lon: 138.9833, city: '新潟市' },
}

export interface DayWeather {
  date: string
  precipMm: number
  rainMm: number
  tempMax: number
  tempMin: number
  windMax: number
  weatherCode: number
  label: string
}

export interface WeatherResult {
  city: string
  raceDay: DayWeather
  prevDay: DayWeather | null
  precip7dayMm: number        // レース日を除く前7日間の累積降水量
  trackEstimate: string
  trackNote: string
}

function wmoLabel(code: number): string {
  if (code === 0)              return '快晴'
  if (code <= 2)               return '晴れ'
  if (code === 3)              return '曇り'
  if (code <= 49)              return '霧'
  if (code <= 59)              return '霧雨'
  if (code <= 69)              return '雨'
  if (code <= 79)              return '雪/みぞれ'
  if (code <= 84)              return 'にわか雨'
  if (code <= 99)              return '雷雨'
  return '不明'
}

// 7日間蓄積を考慮した馬場推定
// effective = 当日 + 前日×0.5 + 7日累積×0.2
function estimateTrack(raceDayMm: number, prevDayMm: number, prior7dayMm: number): { estimate: string; note: string } {
  const effective = raceDayMm + prevDayMm * 0.5 + prior7dayMm * 0.2
  const detail = `実効${effective.toFixed(1)}mm（当日${raceDayMm.toFixed(1)}+前日半分+7日蓄積${prior7dayMm.toFixed(1)}mm×0.2）`
  if (effective < 1)   return { estimate: '良',   note: detail }
  if (effective < 6)   return { estimate: '稍重', note: detail }
  if (effective < 18)  return { estimate: '重',   note: detail }
  return               { estimate: '不良', note: detail }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildUrl(base: string, lat: number, lon: number, start: string, end: string): string {
  return `${base}?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,rain_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,weather_code` +
    `&start_date=${start}&end_date=${end}&timezone=Asia%2FTokyo`
}

function parseDays(json: Record<string, unknown>): DayWeather[] {
  const d = json.daily as Record<string, unknown[]>
  return (d.time as string[]).map((date, i) => ({
    date,
    precipMm:    (d.precipitation_sum[i] as number) ?? 0,
    rainMm:      (d.rain_sum[i] as number) ?? 0,
    tempMax:     (d.temperature_2m_max[i] as number) ?? 0,
    tempMin:     (d.temperature_2m_min[i] as number) ?? 0,
    windMax:     (d.wind_speed_10m_max[i] as number) ?? 0,
    weatherCode: (d.weather_code[i] as number) ?? 0,
    label:       wmoLabel((d.weather_code[i] as number) ?? 0),
  }))
}

export async function fetchWeatherForecast(course: string, raceDate: string): Promise<WeatherResult | null> {
  const coords = VENUE_COORDS[course]
  if (!coords) return null

  const prevDate = addDays(raceDate, -1)
  const start    = addDays(raceDate, -7)  // 7日前から取得

  const today  = new Date().toISOString().slice(0, 10)
  const base   = raceDate >= today
    ? 'https://api.open-meteo.com/v1/forecast'
    : 'https://archive-api.open-meteo.com/v1/archive'

  try {
    const res = await fetch(buildUrl(base, coords.lat, coords.lon, start, raceDate), {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const json = await res.json() as Record<string, unknown>
    const days = parseDays(json)

    const raceDay = days.find((d) => d.date === raceDate) ?? days[days.length - 1]
    const prevDay = days.find((d) => d.date === prevDate) ?? null

    // レース日を除く前7日分の累積
    const prior7dayMm = days
      .filter((d) => d.date !== raceDate)
      .reduce((sum, d) => sum + d.precipMm, 0)

    const { estimate, note } = estimateTrack(raceDay.precipMm, prevDay?.precipMm ?? 0, prior7dayMm)

    return { city: coords.city, raceDay, prevDay, precip7dayMm: prior7dayMm, trackEstimate: estimate, trackNote: note }
  } catch {
    return null
  }
}
