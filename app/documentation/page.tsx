import { getDocumentation, getMetafieldValue } from '@/lib/cosmic'

export default async function DocumentationPage() {
  const docs = await getDocumentation()

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">📚 Documentation</h1>
        <p className="text-slate-600 mt-2">Guides and references for the AI proxy</p>
      </header>

      {docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">No documentation available yet.</p>
          <div className="text-left max-w-2xl mx-auto">
            <h3 className="font-bold mb-3">🚀 Tool Calling Protocol Implementation</h3>
            <p className="text-sm text-slate-600 mb-4">
              The proxy implements full bidirectional protocol conversion between OpenAI Chat Completions
              and Anthropic Messages API for Claude models.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">
              <pre>{`// OpenAI request → Anthropic format
{
  tools: [{ type: "function", function: {...} }]
  messages: [{ role: "tool", tool_call_id: "..." }]
}

// Becomes Anthropic format internally
{
  tools: [{ name, description, input_schema }]
  messages: [{
    role: "user",
    content: [{ type: "tool_result", tool_use_id, content }]
  }]
}

// Anthropic response → OpenAI format
{
  content: [{ type: "tool_use", id, name, input }]
}

// Becomes OpenAI format for client
{
  choices: [{
    message: {
      role: "assistant",
      tool_calls: [{
        id, type: "function",
        function: { name, arguments }
      }]
    }
  }]
}`}</pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map((doc) => {
            const category = getMetafieldValue(doc.metadata?.category)
            const content = getMetafieldValue(doc.metadata?.content)
            return (
              <article key={doc.id} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xl font-bold">{getMetafieldValue(doc.metadata?.title) || doc.title}</h2>
                  {category && (
                    <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-full">{category}</span>
                  )}
                </div>
                <div className="prose prose-slate max-w-none text-sm whitespace-pre-wrap">
                  {content}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}