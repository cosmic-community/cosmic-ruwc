'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/api-keys', label: 'API Keys', icon: '🔑' },
  { href: '/model-routes', label: 'Model Routes', icon: '🤖' },
  { href: '/request-logs', label: 'Request Logs', icon: '📋' },
  { href: '/documentation', label: 'Documentation', icon: '📚' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white p-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span>🚀</span>
          <span>AI Proxy</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">OpenAI-Compatible Gateway</p>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto text-xs text-slate-500">
        <p>v1.0.0</p>
      </div>
    </aside>
  )
}