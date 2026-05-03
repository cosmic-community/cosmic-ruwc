import { createBucketClient } from '@cosmicjs/sdk'
import { hasStatus, ApiKey, ModelRoute, RequestLog, Documentation } from '@/types'

export const cosmic = createBucketClient({
  bucketSlug: process.env.COSMIC_BUCKET_SLUG as string,
  readKey: process.env.COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
})

export function getMetafieldValue(field: unknown): string {
  if (field === null || field === undefined) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'number' || typeof field === 'boolean') return String(field);
  if (typeof field === 'object' && field !== null && 'value' in field) {
    return String((field as { value: unknown }).value);
  }
  if (typeof field === 'object' && field !== null && 'key' in field) {
    return String((field as { key: unknown }).key);
  }
  return '';
}

export async function getApiKeys(): Promise<ApiKey[]> {
  try {
    const res = await cosmic.objects.find({ type: 'api-keys' }).props(['id', 'slug', 'title', 'metadata']).depth(1)
    return res.objects as ApiKey[]
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return []
    throw error
  }
}

export async function getModelRoutes(): Promise<ModelRoute[]> {
  try {
    const res = await cosmic.objects.find({ type: 'model-routes' }).props(['id', 'slug', 'title', 'metadata']).depth(1)
    return res.objects as ModelRoute[]
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return []
    throw error
  }
}

export async function getRequestLogs(): Promise<RequestLog[]> {
  try {
    const res = await cosmic.objects.find({ type: 'request-logs' }).props(['id', 'slug', 'title', 'metadata', 'created_at']).depth(1)
    const logs = res.objects as RequestLog[]
    return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return []
    throw error
  }
}

export async function getDocumentation(): Promise<Documentation[]> {
  try {
    const res = await cosmic.objects.find({ type: 'documentation' }).props(['id', 'slug', 'title', 'metadata']).depth(1)
    const docs = res.objects as Documentation[]
    return docs.sort((a, b) => (a.metadata?.order || 0) - (b.metadata?.order || 0))
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return []
    throw error
  }
}

export async function getDocumentationBySlug(slug: string): Promise<Documentation | null> {
  try {
    const res = await cosmic.objects.findOne({ type: 'documentation', slug }).depth(1)
    return res.object as Documentation
  } catch (error) {
    if (hasStatus(error) && error.status === 404) return null
    throw error
  }
}