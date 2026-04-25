export interface Race {
  id: string
  date: string
  course: string
  distance: number
  track_type: string
  track_condition: number
  weather: string | null
  grade: string | null
  race_name: string
  netkeiba_race_id: string
  precipitation_mm: number | null
  prev_day_precip_mm: number | null
  precip_7day_mm: number | null
  track_condition_est: number | null
  track_bias_score: number | null
}

export interface RaceResult {
  id: string
  race_id: string
  finish_position: number | null
  horse_number: number
  post_position: number | null
  weight_carried: number | null
  time_seconds: number | null
  time_index: number | null
  last_3f_time: number | null
  odds: number | null
  popularity: number | null
  horse_weight: number | null
  horse_weight_change: number | null
  horses: { name: string }
  jockeys: { name: string }
  trainers: { name: string }
}

export const TRACK_CONDITION_LABEL: Record<number, string> = {
  0: '良',
  1: '稍重',
  2: '重',
  3: '不良',
}

export const GRADE_COLOR: Record<string, string> = {
  G1: 'bg-red-600 text-white',
  G2: 'bg-blue-600 text-white',
  G3: 'bg-green-600 text-white',
  L:  'bg-purple-600 text-white',
  OP: 'bg-gray-500 text-white',
}
