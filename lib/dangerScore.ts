import type { HorseWithHistory } from '@/types/upcoming'

export interface DangerResult {
  score: number
  flags: string[]
}

export function calcDangerScore(
  horse: HorseWithHistory,
  raceDistance: number,
  raceTrackType: string,
  allHorses: HorseWithHistory[],
): DangerResult {
  const flags: string[] = []
  let score = 0

  if (horse.horse_weight_change != null) {
    if (horse.horse_weight_change <= -8) { score += 2; flags.push(`馬体重急減(${horse.horse_weight_change}kg)`) }
    else if (horse.horse_weight_change >= 10) { score += 2; flags.push(`馬体重急増(+${horse.horse_weight_change}kg)`) }
  }

  if (horse.is_jockey_changed === true) { score += 1; flags.push('乗り替わり') }

  if (horse.rest_weeks != null) {
    if (horse.rest_weeks >= 24) { score += 3; flags.push(`超長期休養(${horse.rest_weeks}週)`) }
    else if (horse.rest_weeks >= 12) { score += 2; flags.push(`長期休養明け(${horse.rest_weeks}週)週`) }
  }

  const lastRace = horse.recent_results[0]
  if (lastRace) {
    if (lastRace.track_type !== raceTrackType) { score += 2; flags.push(`${lastRace.track_type}→${raceTrackType}替わり`) }
    const distDiff = Math.abs(lastRace.distance - raceDistance)
    if (distDiff >= 600) { score += 2; flags.push(`距離大幅変更(±${distDiff}m)`) }
    else if (distDiff >= 400) { score += 1; flags.push(`距離変更(±${distDiff}m)`) }
  }

  const validIndices = allHorses
    .filter(h => h.avg_time_index != null)
    .map(h => h.avg_time_index!)
    .sort((a, b) => b - a)
  if (validIndices.length >= 4 && horse.avg_time_index != null) {
    const cutoff = validIndices[Math.floor(validIndices.length * 2 / 3)]
    if (horse.avg_time_index < cutoff) { score += 1; flags.push('タイム指数が下位圏') }
  }

  return { score, flags }
}

export function isPopularHorse(horse: HorseWithHistory, allHorses: HorseWithHistory[]): boolean {
  if (horse.popularity != null) return horse.popularity <= 3
  if (horse.ml_score != null) {
    const sorted = [...allHorses].filter(h => h.ml_score != null).sort((a, b) => b.ml_score! - a.ml_score!)
    return sorted.slice(0, 3).some(h => h.horse_name === horse.horse_name)
  }
  const sorted = [...allHorses].filter(h => h.avg_time_index != null).sort((a, b) => b.avg_time_index! - a.avg_time_index!)
  return sorted.slice(0, 3).some(h => h.horse_name === horse.horse_name)
}
