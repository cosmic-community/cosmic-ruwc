import { getModelRoutes, getMetafieldValue } from '@/lib/cosmic'

export default async function ModelRoutesPage() {
  const routes = await getModelRoutes()

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">🤖 Model Routes</h1>
        <p className="text-slate-600 mt-2">Available models routed by the proxy</p>
      </header>

      {routes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No model routes configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route) => {
            const provider = getMetafieldValue(route.metadata?.provider)
            const providerColor: Record<string, string> = {
              openai: 'bg-green-100 text-green-700',
              anthropic: 'bg-orange-100 text-orange-700',
              gemini: 'bg-blue-100 text-blue-700',
              openrouter: 'bg-purple-100 text-purple-700',
            }
            const colorClass = providerColor[provider.toLowerCase()] || 'bg-gray-100 text-gray-700'
            return (
              <div key={route.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{getMetafieldValue(route.metadata?.display_name) || route.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${colorClass}`}>{provider || 'Unknown'}</span>
                </div>
                <code className="block text-xs font-mono text-slate-600 mb-3">
                  {getMetafieldValue(route.metadata?.model_id)}
                </code>
                <div className="flex gap-2 mb-3">
                  {route.metadata?.supports_tools && (
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">🔧 Tools</span>
                  )}
                  {route.metadata?.supports_streaming && (
                    <span className="text-xs px-2 py-1 bg-pink-50 text-pink-700 rounded">⚡ Streaming</span>
                  )}
                </div>
                {route.metadata?.description && (
                  <p className="text-sm text-slate-600">{getMetafieldValue(route.metadata?.description)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}