import Link from 'next/link'

interface Props {
  active: 'races' | 'upcoming' | 'simulate'
}

const NAV = [
  { href: '/',         label: '過去レース',         key: 'races'    },
  { href: '/upcoming', label: '🗓️ 出走予定',       key: 'upcoming' },
  { href: '/simulate', label: '🔬 シミュレーター',  key: 'simulate' },
] as const

export function SiteHeader({ active }: Props) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">🏇 競馬AI分析</h1>
      <p className="mt-1 text-sm text-gray-500">JRA重賞データに基づくデータサイエンス指向の展開分析</p>
      <div className="flex gap-2 mt-4 flex-wrap">
        {NAV.map((n) =>
          n.key === active ? (
            <span key={n.key} className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white">
              {n.label}
            </span>
          ) : (
            <Link
              key={n.key}
              href={n.href}
              className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              {n.label}
            </Link>
          )
        )}
      </div>
    </div>
  )
}
