import { NextRequest, NextResponse } from 'next/server'
import { cosmic, getMetafieldValue } from '@/lib/cosmic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------- Types ----------

interface OpenAIToolFunction {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

interface OpenAITool {
  type: 'function'
  function: OpenAIToolFunction
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{ type: string; text?: string; [k: string]: unknown }> | null
  name?: string
  tool_call_id?: string
  tool_calls?: OpenAIToolCall[]
}

interface OpenAIChatRequest {
  model: string
  messages: OpenAIMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  stream?: boolean
  tools?: OpenAITool[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
  stop?: string | string[]
  user?: string
}

// ---------- Helpers ----------

function jsonError(status: number, message: string, type = 'invalid_request_error', code?: string) {
  return NextResponse.json(
    { error: { message, type, code: code ?? null, param: null } },
    { status }
  )
}

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m && m[1] ? m[1].trim() : null
}

async function validateApiKey(presentedKey: string): Promise<{ valid: boolean; keyName?: string }> {
  try {
    const res = await cosmic.objects
      .find({ type: 'api-keys' })
      .props(['id', 'title', 'metadata'])
      .depth(1)
    const keys = (res.objects || []) as Array<{ title: string; metadata?: Record<string, unknown> }>
    for (const k of keys) {
      const stored = getMetafieldValue(k.metadata?.api_key)
      const status = getMetafieldValue(k.metadata?.status)
      if (stored && stored === presentedKey && status === 'Active') {
        return { valid: true, keyName: k.title }
      }
    }
    return { valid: false }
  } catch {
    return { valid: false }
  }
}

type ProviderName = 'OpenAI' | 'Anthropic' | 'Gemini' | 'OpenRouter'

function detectProvider(model: string): ProviderName {
  const m = model.toLowerCase()
  if (m.startsWith('claude') || m.includes('anthropic')) return 'Anthropic'
  if (m.startsWith('gemini') || m.startsWith('models/gemini')) return 'Gemini'
  if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4') || m.startsWith('chatgpt')) return 'OpenAI'
  if (m.includes('/')) return 'OpenRouter'
  return 'OpenRouter'
}

async function logRequest(params: {
  request_id: string
  model_used: string
  provider: ProviderName
  status: 'Success' | 'Error' | 'Timeout'
  streaming: boolean
  used_tools: boolean
  latency_ms: number
  prompt_tokens?: number | null
  completion_tokens?: number | null
  notes?: string
}): Promise<void> {
  try {
    await cosmic.objects.insertOne({
      title: `${params.provider} ${params.status} - ${params.model_used}`,
      type: 'request-logs',
      metadata: {
        request_id: params.request_id,
        model_used: params.model_used,
        provider: params.provider,
        status: params.status,
        streaming: params.streaming,
        used_tools: params.used_tools,
        latency_ms: params.latency_ms,
        prompt_tokens: params.prompt_tokens ?? null,
        completion_tokens: params.completion_tokens ?? null,
        notes: params.notes || '',
      },
    })
  } catch {
    // Logging is best-effort; never break the proxy on logging failures.
  }
}

function messageContentToString(content: OpenAIMessage['content']): string {
  if (typeof content === 'string') return content
  if (!content) return ''
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : typeof c.text === 'string' ? c.text : ''))
      .join('')
  }
  return ''
}

// ---------- OpenAI → Anthropic translation ----------

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string | Array<{ type: 'text'; text: string }>
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: AnthropicContentBlock[]
}

interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

function openAIMessagesToAnthropic(messages: OpenAIMessage[]): {
  system: string | undefined
  messages: AnthropicMessage[]
} {
  let systemParts: string[] = []
  const out: AnthropicMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      const t = messageContentToString(msg.content)
      if (t) systemParts.push(t)
      continue
    }

    if (msg.role === 'tool') {
      const block: AnthropicContentBlock = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id || '',
        content: messageContentToString(msg.content),
      }
      // Append to last user message or create one
      const last = out[out.length - 1]
      if (last && last.role === 'user') {
        last.content.push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
      continue
    }

    if (msg.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = []
      const text = messageContentToString(msg.content)
      if (text) blocks.push({ type: 'text', text })
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let parsedInput: Record<string, unknown> = {}
          try {
            parsedInput = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
          } catch {
            parsedInput = {}
          }
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: parsedInput,
          })
        }
      }
      if (blocks.length === 0) blocks.push({ type: 'text', text: '' })
      out.push({ role: 'assistant', content: blocks })
      continue
    }

    // user
    const text = messageContentToString(msg.content)
    out.push({ role: 'user', content: [{ type: 'text', text }] })
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: out,
  }
}

function openAIToolsToAnthropic(tools?: OpenAITool[]): AnthropicTool[] | undefined {
  if (!tools || tools.length === 0) return undefined
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: (t.function.parameters as Record<string, unknown>) || { type: 'object', properties: {} },
  }))
}

function openAIToolChoiceToAnthropic(
  tc: OpenAIChatRequest['tool_choice']
): Record<string, unknown> | undefined {
  if (!tc) return undefined
  if (tc === 'auto') return { type: 'auto' }
  if (tc === 'none') return undefined
  if (tc === 'required') return { type: 'any' }
  if (typeof tc === 'object' && tc.type === 'function') {
    return { type: 'tool', name: tc.function.name }
  }
  return undefined
}

// ---------- Anthropic → OpenAI translation ----------

interface AnthropicResponse {
  id: string
  type: string
  role: string
  model: string
  content: Array<{
    type: string
    text?: string
    id?: string
    name?: string
    input?: Record<string, unknown>
  }>
  stop_reason: string | null
  usage?: { input_tokens?: number; output_tokens?: number }
}

function anthropicResponseToOpenAI(
  resp: AnthropicResponse,
  modelRequested: string
): {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string | null
      tool_calls?: OpenAIToolCall[]
    }
    finish_reason: string
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
} {
  let textOut = ''
  const toolCalls: OpenAIToolCall[] = []
  for (const block of resp.content || []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textOut += block.text
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id || genId('call'),
        type: 'function',
        function: {
          name: block.name || '',
          arguments: JSON.stringify(block.input ?? {}),
        },
      })
    }
  }

  const stopMap: Record<string, string> = {
    end_turn: 'stop',
    max_tokens: 'length',
    stop_sequence: 'stop',
    tool_use: 'tool_calls',
  }
  const finish_reason = stopMap[resp.stop_reason || ''] || 'stop'

  return {
    id: genId('chatcmpl'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelRequested,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: textOut.length > 0 ? textOut : null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason,
      },
    ],
    usage: {
      prompt_tokens: resp.usage?.input_tokens ?? 0,
      completion_tokens: resp.usage?.output_tokens ?? 0,
      total_tokens: (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0),
    },
  }
}

// ---------- Anthropic SSE streaming → OpenAI SSE ----------

async function streamAnthropic(
  upstream: Response,
  modelRequested: string,
  requestId: string
): Promise<Response> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const chatId = genId('chatcmpl')
  const created = Math.floor(Date.now() / 1000)

  // Track tool_use blocks by index for streaming arguments deltas
  const toolBlocks: Record<number, { id: string; name: string; argBuffer: string }> = {}

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      // First chunk: role
      send({
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model: modelRequested,
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      })

      const reader = upstream.body?.getReader()
      if (!reader) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      let buffer = ''
      let finishReason: string | null = null
      let currentEvent = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const rawLine of lines) {
            const line = rawLine.trimEnd()
            if (line === '') {
              currentEvent = ''
              continue
            }
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
              continue
            }
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data) continue

            let parsed: Record<string, unknown>
            try {
              parsed = JSON.parse(data)
            } catch {
              continue
            }

            const evType = (parsed.type as string) || currentEvent

            if (evType === 'content_block_start') {
              const idx = parsed.index as number
              const block = parsed.content_block as Record<string, unknown> | undefined
              if (block && block.type === 'tool_use') {
                const toolId = (block.id as string) || genId('call')
                const toolName = (block.name as string) || ''
                toolBlocks[idx] = { id: toolId, name: toolName, argBuffer: '' }
                send({
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created,
                  model: modelRequested,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_calls: [
                          {
                            index: idx,
                            id: toolId,
                            type: 'function',
                            function: { name: toolName, arguments: '' },
                          },
                        ],
                      },
                      finish_reason: null,
                    },
                  ],
                })
              }
            } else if (evType === 'content_block_delta') {
              const idx = parsed.index as number
              const delta = parsed.delta as Record<string, unknown> | undefined
              if (!delta) continue
              if (delta.type === 'text_delta' && typeof delta.text === 'string') {
                send({
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created,
                  model: modelRequested,
                  choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }],
                })
              } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
                const tb = toolBlocks[idx]
                if (tb) tb.argBuffer += delta.partial_json
                send({
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created,
                  model: modelRequested,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_calls: [
                          {
                            index: idx,
                            function: { arguments: delta.partial_json },
                          },
                        ],
                      },
                      finish_reason: null,
                    },
                  ],
                })
              }
            } else if (evType === 'message_delta') {
              const delta = parsed.delta as Record<string, unknown> | undefined
              if (delta && typeof delta.stop_reason === 'string') {
                const map: Record<string, string> = {
                  end_turn: 'stop',
                  max_tokens: 'length',
                  stop_sequence: 'stop',
                  tool_use: 'tool_calls',
                }
                finishReason = map[delta.stop_reason] || 'stop'
              }
            } else if (evType === 'message_stop') {
              // handled at end
            }
          }
        }
      } catch (err) {
        send({
          id: chatId,
          object: 'chat.completion.chunk',
          created,
          model: modelRequested,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
          error: { message: err instanceof Error ? err.message : 'stream error' },
        })
      }

      send({
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model: modelRequested,
        choices: [{ index: 0, delta: {}, finish_reason: finishReason || 'stop' }],
      })
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()

      // best-effort log
      void logRequest({
        request_id: requestId,
        model_used: modelRequested,
        provider: 'Anthropic',
        status: 'Success',
        streaming: true,
        used_tools: Object.keys(toolBlocks).length > 0,
        latency_ms: 0,
        notes: 'Streaming proxied OpenAI←→Anthropic',
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

// ---------- Provider call: Anthropic ----------

async function callAnthropic(
  body: OpenAIChatRequest,
  requestId: string
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return jsonError(500, 'ANTHROPIC_API_KEY is not configured on the proxy server', 'configuration_error')
  }

  const { system, messages } = openAIMessagesToAnthropic(body.messages)
  const tools = openAIToolsToAnthropic(body.tools)
  const toolChoice = openAIToolChoiceToAnthropic(body.tool_choice)

  const anthroBody: Record<string, unknown> = {
    model: body.model,
    messages,
    max_tokens: body.max_tokens ?? 4096,
    stream: !!body.stream,
  }
  if (system) anthroBody.system = system
  if (typeof body.temperature === 'number') anthroBody.temperature = body.temperature
  if (typeof body.top_p === 'number') anthroBody.top_p = body.top_p
  if (tools) anthroBody.tools = tools
  if (toolChoice) anthroBody.tool_choice = toolChoice
  if (body.stop) anthroBody.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop]

  const start = Date.now()
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(anthroBody),
  })

  if (!upstream.ok) {
    const errText = await upstream.text()
    void logRequest({
      request_id: requestId,
      model_used: body.model,
      provider: 'Anthropic',
      status: 'Error',
      streaming: !!body.stream,
      used_tools: !!tools,
      latency_ms: Date.now() - start,
      notes: `Upstream ${upstream.status}: ${errText.slice(0, 500)}`,
    })
    return new NextResponse(errText, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    })
  }

  if (body.stream) {
    return streamAnthropic(upstream, body.model, requestId)
  }

  const data = (await upstream.json()) as AnthropicResponse
  const openAIResp = anthropicResponseToOpenAI(data, body.model)

  void logRequest({
    request_id: requestId,
    model_used: body.model,
    provider: 'Anthropic',
    status: 'Success',
    streaming: false,
    used_tools: !!tools,
    latency_ms: Date.now() - start,
    prompt_tokens: openAIResp.usage.prompt_tokens,
    completion_tokens: openAIResp.usage.completion_tokens,
    notes: 'OpenAI→Anthropic→OpenAI translation OK',
  })

  return NextResponse.json(openAIResp)
}

// ---------- Provider call: OpenAI passthrough ----------

async function callOpenAI(body: OpenAIChatRequest, requestId: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return jsonError(500, 'OPENAI_API_KEY is not configured on the proxy server', 'configuration_error')
  }
  const start = Date.now()
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (body.stream) {
    void logRequest({
      request_id: requestId,
      model_used: body.model,
      provider: 'OpenAI',
      status: upstream.ok ? 'Success' : 'Error',
      streaming: true,
      used_tools: !!body.tools,
      latency_ms: Date.now() - start,
      notes: 'Streaming passthrough',
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const text = await upstream.text()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  const usage = (parsed?.usage as { prompt_tokens?: number; completion_tokens?: number }) || {}
  void logRequest({
    request_id: requestId,
    model_used: body.model,
    provider: 'OpenAI',
    status: upstream.ok ? 'Success' : 'Error',
    streaming: false,
    used_tools: !!body.tools,
    latency_ms: Date.now() - start,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    notes: upstream.ok ? 'Direct passthrough' : `Upstream ${upstream.status}`,
  })
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  })
}

// ---------- Provider call: OpenRouter ----------

async function callOpenRouter(body: OpenAIChatRequest, requestId: string): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return jsonError(500, 'OPENROUTER_API_KEY is not configured on the proxy server', 'configuration_error')
  }
  const start = Date.now()
  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (body.stream) {
    void logRequest({
      request_id: requestId,
      model_used: body.model,
      provider: 'OpenRouter',
      status: upstream.ok ? 'Success' : 'Error',
      streaming: true,
      used_tools: !!body.tools,
      latency_ms: Date.now() - start,
      notes: 'Streaming passthrough',
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const text = await upstream.text()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  const usage = (parsed?.usage as { prompt_tokens?: number; completion_tokens?: number }) || {}
  void logRequest({
    request_id: requestId,
    model_used: body.model,
    provider: 'OpenRouter',
    status: upstream.ok ? 'Success' : 'Error',
    streaming: false,
    used_tools: !!body.tools,
    latency_ms: Date.now() - start,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    notes: upstream.ok ? 'OpenRouter passthrough' : `Upstream ${upstream.status}`,
  })
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  })
}

// ---------- Provider call: Gemini (basic, non-tool path) ----------

async function callGemini(body: OpenAIChatRequest, requestId: string): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return jsonError(500, 'GEMINI_API_KEY is not configured on the proxy server', 'configuration_error')
  }
  const start = Date.now()

  const contents = body.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: messageContentToString(m.content) }],
    }))

  const systemMsg = body.messages.find((m) => m.role === 'system')
  const geminiBody: Record<string, unknown> = { contents }
  if (systemMsg) {
    geminiBody.systemInstruction = { parts: [{ text: messageContentToString(systemMsg.content) }] }
  }
  if (typeof body.temperature === 'number' || typeof body.max_tokens === 'number') {
    geminiBody.generationConfig = {
      ...(typeof body.temperature === 'number' ? { temperature: body.temperature } : {}),
      ...(typeof body.max_tokens === 'number' ? { maxOutputTokens: body.max_tokens } : {}),
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    body.model
  )}:generateContent?key=${apiKey}`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  })

  const text = await upstream.text()
  if (!upstream.ok) {
    void logRequest({
      request_id: requestId,
      model_used: body.model,
      provider: 'Gemini',
      status: 'Error',
      streaming: false,
      used_tools: false,
      latency_ms: Date.now() - start,
      notes: `Upstream ${upstream.status}: ${text.slice(0, 300)}`,
    })
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }
  const candidates = (data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>) || []
  const firstParts = candidates[0]?.content?.parts || []
  const textOut = firstParts.map((p) => p.text || '').join('')
  const usageMeta = (data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number }) || {}

  const openAIResp = {
    id: genId('chatcmpl'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: textOut },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: usageMeta.promptTokenCount ?? 0,
      completion_tokens: usageMeta.candidatesTokenCount ?? 0,
      total_tokens: (usageMeta.promptTokenCount ?? 0) + (usageMeta.candidatesTokenCount ?? 0),
    },
  }

  void logRequest({
    request_id: requestId,
    model_used: body.model,
    provider: 'Gemini',
    status: 'Success',
    streaming: false,
    used_tools: false,
    latency_ms: Date.now() - start,
    prompt_tokens: openAIResp.usage.prompt_tokens,
    completion_tokens: openAIResp.usage.completion_tokens,
    notes: 'Gemini → OpenAI translation OK',
  })

  return NextResponse.json(openAIResp)
}

// ---------- Route handlers ----------

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = genId('chatcmpl')

  // 1. Auth
  const presented = extractBearer(req)
  if (!presented) {
    return jsonError(401, 'Missing or malformed Authorization header. Expected: Authorization: Bearer <key>', 'authentication_error')
  }
  const auth = await validateApiKey(presented)
  if (!auth.valid) {
    void logRequest({
      request_id: requestId,
      model_used: 'unknown',
      provider: 'OpenAI',
      status: 'Error',
      streaming: false,
      used_tools: false,
      latency_ms: 0,
      notes: '401 Unauthorized — invalid or revoked proxy API key.',
    })
    return jsonError(401, 'Invalid or revoked API key', 'authentication_error', 'invalid_api_key')
  }

  // 2. Parse body
  let body: OpenAIChatRequest
  try {
    body = (await req.json()) as OpenAIChatRequest
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!body || typeof body !== 'object') {
    return jsonError(400, 'Request body must be a JSON object')
  }
  if (typeof body.model !== 'string' || !body.model) {
    return jsonError(400, 'Missing required field: model')
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, 'Missing required field: messages (must be a non-empty array)')
  }

  // 3. Route
  const provider = detectProvider(body.model)

  try {
    if (provider === 'Anthropic') return await callAnthropic(body, requestId)
    if (provider === 'OpenAI') return await callOpenAI(body, requestId)
    if (provider === 'Gemini') return await callGemini(body, requestId)
    return await callOpenRouter(body, requestId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown proxy error'
    void logRequest({
      request_id: requestId,
      model_used: body.model,
      provider,
      status: 'Error',
      streaming: !!body.stream,
      used_tools: !!body.tools,
      latency_ms: 0,
      notes: `Proxy exception: ${msg}`,
    })
    return jsonError(502, `Upstream proxy error: ${msg}`, 'upstream_error')
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({
    object: 'endpoint',
    endpoint: '/v1/chat/completions',
    method: 'POST',
    description: 'OpenAI-compatible chat completions proxy with Claude tool-call translation',
    supported_providers: ['OpenAI', 'Anthropic', 'Gemini', 'OpenRouter'],
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}