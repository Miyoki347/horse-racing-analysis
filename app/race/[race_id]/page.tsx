import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GradeBadge } from '@/components/GradeBadge'
import { HorseTable } from '@/components/HorseTable'
import { TimeIndexChart } from '@/components/TimeIndexChart'
import { AnalysisPanel } from '@/components/AnalysisPanel'
import { PrecipitationBadge } from '@/components/PrecipitationBadge'
import { PredictionRanking } from '@/components/PredictionRanking'
import { TRACK_CONDITION_LABEL } from '@/types/race'

interface PageProps {
  params: Promise<{ race_id: string }>
}

export default async function RaceDetailPage({ params }: PageProps) {
  const { race_id } = await params

  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('netkeiba_race_id', race_id)
    .single()

  if (!race) notFound()

  const { data: results } = await supabase
    .from('race_results')
    .select('*, horses(name), jockeys(name, display_name), trainers(name)')
    .eq('race_id', race.id)
    .order('finish_position')

  const safeResults = results ?? []

  const winner = safeResults.find((r) => r.finish_position === 1)
  const avgIndex = safeResults.length > 0
    ? (safeResults.reduce((s, r) => s + (r.time_index ?? 0), 0) / safeResults.length).toFixed(1)
    : '-'

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* 戻るリンク */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          ← レース一覧に戻る
        </Link>

        {/* レース情報カード */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <GradeBadge grade={race.grade} />
            <h1 className="text-xl font-bold text-gray-900">{race.race_name}</h1>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600">
            <div><span className="text-xs text-gray-400 block">開催日</span>{race.date}</div>
            <div><span className="text-xs text-gray-400 block">会場</span>{race.course}</div>
            <div><span className="text-xs text-gray-400 block">距離・種別</span>{race.track_type} {race.distance}m</div>
            <div><span className="text-xs text-gray-400 block">馬場 / 天候</span>{TRACK_CONDITION_LABEL[race.track_condition]} / {race.weather ?? '-'}</div>
          </div>
        </div>

        {/* サマリーカード */}
        {winner && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '1着', value: winner.horses?.name, sub: winner.jockeys?.display_name ?? winner.jockeys?.name },
              { label: '勝ちタイム', value: winner.time_seconds
                  ? `${Math.floor(winner.time_seconds / 60)}:${(winner.time_seconds % 60).toFixed(1).padStart(4,'0')}`
                  : '-', sub: `上がり${winner.last_3f_time ?? '-'}秒` },
              { label: '平均タイム指数', value: avgIndex, sub: `出走${safeResults.length}頭` },
              { label: '馬場差', value: race.track_bias_score != null
                  ? `${race.track_bias_score > 0 ? '+' : ''}${race.track_bias_score.toFixed(2)}秒`
                  : '-',
                sub: race.track_bias_score != null
                  ? race.track_bias_score > 0.5 ? '⚡ 速い馬場'
                  : race.track_bias_score < -0.5 ? '🌧️ 遅い馬場'
                  : '± 標準的な馬場'
                  : '基準タイム未算出' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-base font-bold text-gray-900 truncate">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* 降水量・馬場データ */}
        <PrecipitationBadge
          precipMm={race.precipitation_mm}
          prevDayMm={race.prev_day_precip_mm}
          precip7dayMm={race.precip_7day_mm}
          actualCondition={race.track_condition}
          estimatedCondition={race.track_condition_est}
        />

        {/* タイム指数チャート */}
        {safeResults.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">📊 タイム指数（上位10頭）</h2>
            <TimeIndexChart results={safeResults} />
          </div>
        )}

        {/* 出走結果テーブル */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">📋 出走結果</h2>
          <HorseTable results={safeResults} />
        </div>

        {/* タイム指数ランキング */}
        {safeResults.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">🏆 タイム指数ランキング（上位5頭）</h2>
            <PredictionRanking results={safeResults} />
          </div>
        )}

        {/* AI展開予想 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-1">🤖 AI展開分析</h2>
          <p className="text-xs text-gray-400 mb-4">
            データに基づく客観的な展開分析です。ギャンブル的な推奨ではありません。
          </p>
          <AnalysisPanel raceId={race_id} />
        </div>

      </div>
    </main>
  )
}
