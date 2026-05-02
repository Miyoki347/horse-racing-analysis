import { supabase } from '@/lib/supabase'
import { SiteHeader } from '@/components/SiteHeader'
import { UpcomingRacesList } from '@/components/UpcomingRacesList'
import type { UpcomingEntry } from '@/types/upcoming'

async function getRaces() {
  const from = new Date()
  from.setMonth(from.getMonth() - 3)
  const fromStr = from.toISOString().split('T')[0]

  const to = new Date()
  to.setMonth(to.getMonth() + 1)
  const toStr = to.toISOString().split('T')[0]

  const { data } = await supabase
    .from('upcoming_entries')
    .select('netkeiba_race_id, race_name, race_date, course, distance, track_type, grade')
    .gte('race_date', fromStr)
    .lte('race_date', toStr)
    .order('race_date', { ascending: true })

  if (!data) return []

  const seen = new Set<string>()
  return data.filter((r: Partial<UpcomingEntry>) => {
    if (seen.has(r.netkeiba_race_id!)) return false
    seen.add(r.netkeiba_race_id!)
    return true
  })
}

export default async function UpcomingPage() {
  const races = await getRaces()
  const today = new Date().toISOString().split('T')[0]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <SiteHeader active="upcoming" />
        <UpcomingRacesList races={races} today={today} />
      </div>
    </main>
  )
}
