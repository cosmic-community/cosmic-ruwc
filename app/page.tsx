import { getApiKeys, getModelRoutes, getRequestLogs, getDocumentation } from '@/lib/cosmic'
import StatCard from '@/components/StatCard'
import Link from 'next/link'

export default async function HomePage() {
  const [apiKeys, modelRoutes, requestLogs, docs] = await Promise.all([
    getApiKeys(),
    getModelRoutes(),
    getRequestLogs(),
    getDocumentation(),
  ])

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">Cosmic AI Proxy — OpenAI-compatible gateway with Claude tool calling support</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="API Keys" value={apiKeys.length} icon="🔑" color="blue" />
        <StatCard label="Model Routes" value={modelRoutes.length} icon="🤖" color="purple" />
        <StatCard label="Request Logs" value={requestLogs.length} icon="📋" color="green" />
        <StatCard label="Docs Pages" value={docs.length} icon="📚" color="orange" />
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🚀 Quick Start</h2>
        <p className="text-slate-600 mb-4">Use this proxy with any OpenAI-compatible client:</p>
        <pre className="code-block">{`curl https://your-cosmic-app.cosmicjs.app/v1/chat/completions \\
  -H "Authorization: Bearer sk-cosmic-xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather",
        "parameters": {"type": "object", "properties": {"location": {"type": "string"}}}
      }
    }]
  }'`}</pre>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/model-routes" className="block bg-white rounded-xl border border-slate-200 p-6 hover:border-brand-500 transition-colors">
          <h3 className="font-bold mb-2">🤖 Available Models</h3>
          <p className="text-sm text-slate-600">View all configured model routes (OpenAI, Anthropic, Gemini, OpenRouter)</p>
        </Link>
        <Link href="/documentation" className="block bg-white rounded-xl border border-slate-200 p-6 hover:border-brand-500 transition-colors">
          <h3 className="font-bold mb-2">📚 Documentation</h3>
          <p className="text-sm text-slate-600">Learn about tool calling protocol conversion and API usage</p>
        </Link>
      </div>

      <section className="mt-8 bg-gradient-to-br from-brand-50 to-purple-50 rounded-xl border border-brand-200 p-6">
        <h2 className="text-xl font-bold mb-3">🔄 Tool Calling Protocol Conversion</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2 text-brand-900">OpenAI → Anthropic</h3>
            <ul className="space-y-1 text-slate-700">
              <li>✓ tools array → Anthropic tools format</li>
              <li>✓ tool_choice mapping</li>
              <li>✓ tool_calls → tool_use blocks</li>
              <li>✓ tool messages → tool_result blocks</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-brand-900">Anthropic → OpenAI</h3>
            <ul className="space-y-1 text-slate-700">
              <li>✓ tool_use → tool_calls</li>
              <li>✓ Mixed content handling</li>
              <li>✓ Streaming tool_call deltas</li>
              <li>✓ finish_reason mapping</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}