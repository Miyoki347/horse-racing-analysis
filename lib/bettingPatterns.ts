import type { HorseWithHistory } from '@/types/upcoming'

export type PatternType = 'honmei' | 'balance' | 'ana'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface BettingPattern {
  type: PatternType
  label: string
  riskLabel: string
  riskLevel: RiskLevel
  betType: string
  axisHorses: HorseWithHistory[]
  targetHorses: HorseWithHistory[]
  reason: string
  aiReason?: string
}

// EVスコア = ml_score × ln(popularity + 1)
// popularity が大きい（人気薄）ほどスコアが高くなる
export function calcEvScore(h: HorseWithHistory): number {
  const score = h.horse_ev_score
  if (score != null) return score
  const ml = h.ml_score ?? 0
  if (ml === 0) return 0
  const pop = h.popularity ?? 8  // NULL の場合は中程度の穴馬扱い
  return ml * Math.log(pop + 1)
}

export function buildBettingPatterns(horses: HorseWithHistory[]): BettingPattern[] {
  if (horses.length === 0) return []

  const byMl = [...horses].sort((a, b) => (b.ml_score ?? 0) - (a.ml_score ?? 0))
  const byEv = [...horses].sort((a, b) => calcEvScore(b) - calcEvScore(a))

  // 本命: ml_score 上位2〜3頭
  const honmeiCount = Math.min(3, byMl.length)
  const honmeiHorses = byMl.slice(0, honmeiCount)
  const honmei: BettingPattern = {
    type: 'honmei',
    label: '本命',
    riskLabel: '低リスク',
    riskLevel: 'low',
    betType: honmeiCount >= 2 ? '単勝・馬連' : '単勝',
    axisHorses: honmeiHorses.slice(0, 1),
    targetHorses: honmeiHorses.slice(1),
    reason: `MLスコア上位${honmeiCount}頭による安定的中狙い`,
  }

  // バランス: ml_score 1位を軸、2〜4位を相手の三連複
  const balAxis = byMl.slice(0, 1)
  const balTargets = byMl.slice(1, Math.min(4, byMl.length))
  const balance: BettingPattern = {
    type: 'balance',
    label: 'バランス',
    riskLabel: '中リスク',
    riskLevel: 'medium',
    betType: '三連複',
    axisHorses: balAxis,
    targetHorses: balTargets,
    reason: `「${balAxis[0]?.horse_name ?? ''}」を軸にMLスコア2〜4位を相手`,
  }

  // 穴狙い: horse_ev_score 上位 かつ popularity >= 4 の馬
  const anaHorses = byEv
    .filter((h) => (h.popularity ?? 99) >= 4)
    .slice(0, 3)
  const ana: BettingPattern = {
    type: 'ana',
    label: '穴狙い',
    riskLabel: '高リスク',
    riskLevel: 'high',
    betType: anaHorses.length >= 2 ? '馬単・三連単' : '単勝',
    axisHorses: anaHorses.slice(0, 1),
    targetHorses: anaHorses.slice(1),
    reason: `EVスコア（予測力×人気薄）上位の高リターン候補`,
  }

  return [honmei, balance, ana]
}

// [BETTING_PATTERNS] ブロックから各パターンの AI 根拠テキストを抽出
// フォーマット: patternType|根拠テキスト
export function parseBettingPatternReasons(
  text: string,
): Partial<Record<PatternType, string>> {
  const m = text.match(/\[BETTING_PATTERNS\]([\s\S]*?)\[\/BETTING_PATTERNS\]/)
  if (!m) return {}

  const result: Partial<Record<PatternType, string>> = {}
  for (const line of m[1].trim().split('\n').filter(Boolean)) {
    const sep = line.indexOf('|')
    if (sep === -1) continue
    const key = line.slice(0, sep).trim() as PatternType
    const val = line.slice(sep + 1).trim()
    if (key && val) result[key] = val
  }
  return result
}
