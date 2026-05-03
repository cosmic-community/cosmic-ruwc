import { getApiKeys, getMetafieldValue } from '@/lib/cosmic'

export default async function ApiKeysPage() {
  const keys = await getApiKeys()

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">🔑 API Keys</h1>
        <p className="text-slate-600 mt-2">Manage proxy authentication keys</p>
      </header>

      {keys.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No API keys yet. Run the proxy to auto-generate one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keys.map((key) => {
            const status = getMetafieldValue(key.metadata?.status)
            const apiKey = getMetafieldValue(key.metadata?.api_key)
            return (
              <div key={key.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{getMetafieldValue(key.metadata?.key_name) || key.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {status || 'Unknown'}
                  </span>
                </div>
                <code className="block bg-slate-100 p-2 rounded text-xs font-mono break-all mb-3">
                  {apiKey || '—'}
                </code>
                {key.metadata?.rate_limit && (
                  <p className="text-sm text-slate-600">Rate limit: {key.metadata.rate_limit}/min</p>
                )}
                {key.metadata?.notes && (
                  <p className="text-sm text-slate-500 mt-2">{getMetafieldValue(key.metadata?.notes)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}