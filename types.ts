export interface CosmicObject {
  id: string;
  slug: string;
  title: string;
  content?: string;
  metadata: Record<string, any>;
  type: string;
  created_at: string;
  modified_at: string;
}

export interface ApiKey extends CosmicObject {
  type: 'api-keys';
  metadata: {
    key_name?: string;
    api_key?: string;
    status?: string | { key: string; value: string };
    rate_limit?: number;
    notes?: string;
  };
}

export interface ModelRoute extends CosmicObject {
  type: 'model-routes';
  metadata: {
    model_id?: string;
    display_name?: string;
    provider?: string | { key: string; value: string };
    supports_tools?: boolean;
    supports_streaming?: boolean;
    description?: string;
  };
}

export interface RequestLog extends CosmicObject {
  type: 'request-logs';
  metadata: {
    request_id?: string;
    model_used?: string;
    provider?: string | { key: string; value: string };
    status?: string | { key: string; value: string };
    streaming?: boolean;
    used_tools?: boolean;
    latency_ms?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    notes?: string;
  };
}

export interface Documentation extends CosmicObject {
  type: 'documentation';
  metadata: {
    title?: string;
    category?: string | { key: string; value: string };
    content?: string;
    order?: number;
  };
}

export function hasStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error;
}