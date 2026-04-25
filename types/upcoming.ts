export interface UpcomingEntry {
  id: string
  netkeiba_race_id: string
  race_name: string
  race_date: string
  course: string
  distance: number
  track_type: string
  grade: string | null
  post_position: number | null
  horse_number: number | null
  horse_name: string
  jockey_name: string | null
  trainer_name: string | null
  weight_carried: number | null
  horse_weight: number | null
  horse_weight_change: number | null
}

export interface HorseWithHistory extends UpcomingEntry {
  avg_time_index: number | null
  best_time_index: number | null
  rest_weeks: number | null
  is_jockey_changed: boolean | null
  jockey_course_win_rate: number | null
  jockey_course_top3_rate: number | null
  jockey_course_race_count: number | null
  recent_results: {
    date: string
    race_name: string
    finish_position: number | null
    time_index: number | null
    last_3f_time: number | null
    distance: number
    track_type: string
  }[]
}
