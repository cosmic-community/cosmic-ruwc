# Cosmic AI Proxy Dashboard

![App Preview](https://imgix.cosmicjs.com/f6d013b0-4730-11f1-ba14-abfa6eebf8a3-autopilot-photo-1518770660439-4636190af475-1777841104992.jpeg?w=1200&h=630&fit=crop&auto=format,compress)

A modern Next.js dashboard for managing an OpenAI-compatible AI proxy that supports bidirectional Claude tool calling protocol conversion.

## 🚀 Deployment Information

**Base URL**: `https://your-cosmic-app.cosmicjs.app`
**API Key**: `sk-cosmic-xxxxx` (auto-generated on first run, check `.proxy-key` file)

## ✨ Tool Calling Conversions Implemented

### OpenAI → Anthropic
- `tools` array → Anthropic `tools` format with `input_schema`
- `tool_choice` mapping (auto/required/specific function)
- Assistant `tool_calls` → `tool_use` content blocks
- `role: "tool"` messages → `tool_result` content blocks
- System messages extracted to top-level `system` parameter

### Anthropic → OpenAI
- `tool_use` blocks → `tool_calls` array with id/type/function
- Mixed text + tool_use → OpenAI message with both `content` and `tool_calls`
- `stop_reason: "tool_use"` → `finish_reason: "tool_calls"`

### Streaming
- `content_block_start` (tool_use) → SSE delta with tool_call start
- `input_json_delta` → tool_call arguments delta
- `content_block_delta` (text) → content delta
- `message_stop` → finish_reason chunk

## Features

- 📊 Real-time dashboard with stats
- 🔑 API Keys management
- 🤖 Model routes catalog
- 📋 Request logs viewer
- 📚 Documentation pages
- 🌗 Modern responsive UI

## Clone this Project

Want to create your own version of this project with all the content and structure? Clone this Cosmic bucket and code repository to get started instantly:

[![Clone this Project](https://img.shields.io/badge/Clone%20this%20Project-29abe2?style=for-the-badge&logo=cosmic&logoColor=white)](https://app.cosmicjs.com/projects/new?clone_bucket=69f7b375c27d356ff50068fc&clone_repository=69f7b460c27d356ff5006930)

## Prompts

This application was built using the following prompts to generate the content structure and code:

### Content Model Prompt

> "Create content models for: 将以下代码部署到 cosmic 并发布（需要 publish），但不是简单部署，你必须先修改代码，使它成为一个'真正兼容 OpenAI Chat Completions 协议'的 AI 代理，并且在 Claude 模型场景下正确支持 tool calling 的双向协议转换。"

### Code Generation Prompt

> "将以下代码部署到 cosmic 并发布（需要 publish），但不是简单部署，你必须先修改代码，使它成为一个'真正兼容 OpenAI Chat Completions 协议'的 AI 代理，并且在 Claude 模型场景下正确支持 tool calling 的双向协议转换。"

The app has been tailored to work with your existing Cosmic content structure and includes all the features requested above.

## Technologies

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Cosmic SDK
- Node.js HTTP proxy (zero-dependency)

## Getting Started

### Prerequisites
- Bun or Node.js 18+
- Cosmic account

### Installation

```bash
bun install
bun run dev
```

## Cosmic SDK Examples

```typescript
import { cosmic } from '@/lib/cosmic'

const { objects } = await cosmic.objects
  .find({ type: 'model-routes' })
  .depth(1)
```

## Deployment

Deploy on Vercel or Cosmic. Add environment variables: `COSMIC_BUCKET_SLUG`, `COSMIC_READ_KEY`, `COSMIC_WRITE_KEY`.

<!-- README_END -->