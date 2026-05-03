import { getRequestLogs, getMetafieldValue } from '@/lib/cosmic'

export default async function RequestLogsPage() {
  const logs = await getRequestLogs()

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">📋 Request Logs</h1>
        <p className="text-slate-600 mt-2">Recent API requests through the proxy</p>
      </header>

      {logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No request logs yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 font-semibold">Request ID</th>
                <th className="text-left p-3 font-semibold">Model</th>
                <th className="text-left p-3 font-semibold">Provider</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Latency</th>
                <th className="text-left p-3 font-semibold">Tokens</th>
                <th className="text-left p-3 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const status = getMetafieldValue(log.metadata?.status)
                const statusColor =
                  status === 'Success' ? 'text-green-700' :
                  status === 'Error' ? 'text-red-700' :
                  'text-slate-600'
                return (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{getMetafieldValue(log.metadata?.request_id) || log.title}</td>
                    <td className="p-3">{getMetafieldValue(log.metadata?.model_used)}</td>
                    <td className="p-3">{getMetafieldValue(log.metadata?.provider)}</td>
                    <td className={`p-3 font-medium ${statusColor}`}>{status}</td>
                    <td className="p-3">{log.metadata?.latency_ms ? `${log.metadata.latency_ms}ms` : '—'}</td>
                    <td className="p-3 text-xs">
                      {(log.metadata?.prompt_tokens || 0)}↓ / {(log.metadata?.completion_tokens || 0)}↑
                    </td>
                    <td className="p-3 text-xs">
                      {log.metadata?.streaming && <span className="mr-1">⚡</span>}
                      {log.metadata?.used_tools && <span>🔧</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}