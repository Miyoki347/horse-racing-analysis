// Claude API 実装（有料課金後に追加予定）
// 推論モード（claude-opus-4-7 with extended thinking）を使用予定
import type { Race, RaceResult } from '@/types/race'

export async function generateRaceAnalysis(
  _race: Race,
  _results: RaceResult[],
): Promise<ReadableStream<Uint8Array>> {
  throw new Error('Claude API は未実装です。CLAUDE_API_KEY と LLM_PROVIDER=claude を設定してください。')
}
