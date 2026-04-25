import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateRaceAnalysis } from '@/lib/llm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ race_id: string }> },
) {
  const { race_id } = await params

  const { data: race, error: raceErr } = await supabase
    .from('races')
    .select('*')
    .eq('netkeiba_race_id', race_id)
    .single()

  if (raceErr || !race) {
    return new Response('Race not found', { status: 404 })
  }

  const { data: results, error: resErr } = await supabase
    .from('race_results')
    .select('*, horses(name), jockeys(name), trainers(name)')
    .eq('race_id', race.id)
    .order('finish_position')

  if (resErr || !results) {
    return new Response('Results not found', { status: 404 })
  }

  const stream = await generateRaceAnalysis(race, results)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
