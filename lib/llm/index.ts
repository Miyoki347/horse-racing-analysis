import type { Race, RaceResult } from '@/types/race'

export async function generateRaceAnalysis(
  race: Race,
  results: RaceResult[],
): Promise<ReadableStream<Uint8Array>> {
  const provider = process.env.LLM_PROVIDER ?? 'gemini'

  if (provider === 'claude') {
    const { generateRaceAnalysis: claudeGenerate } = await import('./claude')
    return claudeGenerate(race, results)
  }

  const { generateRaceAnalysis: geminiGenerate } = await import('./gemini')
  return geminiGenerate(race, results)
}
