// The slice of the host API this plugin uses. The source of truth is
// `src/plugins/api.ts` in the Trawl repo.
import type * as React from "react";

export interface SendRequest {
  method: string;
  url: string;
  headers: [string, string][];
  body: string;
}

export interface SendResponse {
  status: number;
  headers: [string, string][];
  body: string;
  bodyIsText: boolean;
  durationMs: number;
  error: string | null;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface UrlParts {
  scheme: string;
  host: string;
  port: number;
  /** Includes the query string. */
  path: string;
}

export interface HttpMessage {
  headers: [string, string][];
  body: string | null;
  bodyB64?: string | null;
}

export interface ResponseMessage extends HttpMessage {
  status: number;
}

export interface HostFlow {
  id: number;
  timestamp: number;
  method: string;
  url: UrlParts;
  request: HttpMessage;
  response: ResponseMessage | null;
  state: string;
  error: string | null;
}

/** Flattened history row — no headers, no body. */
export interface FlowRow {
  id: number;
  ts: number;
  method: string;
  scheme: string;
  host: string;
  port: number;
  path: string;
  status: number | null;
  projectId: string | null;
  state: string;
  error: string | null;
}

export interface FlowQuery {
  query?: string;
  method?: string;
  statusClass?: string;
  host?: string;
  projectId?: string;
  startTs?: number;
  endTs?: number;
}

export interface TrawlHost {
  version: string;
  react: typeof React;
  http: { send(req: SendRequest, viaProxy?: boolean): Promise<SendResponse> };
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  projects: {
    active(): { id: string; name: string; env: EnvVar[] } | null;
    onChange(cb: () => void): () => void;
  };
  secrets: { get(name: string): Promise<string | null> };
  flows: {
    query(filter: FlowQuery, limit?: number, offset?: number): Promise<FlowRow[]>;
    count(filter: FlowQuery): Promise<number>;
    subscribe(cb: (flow: unknown) => void): () => void;
  };
  util: { bodyText(msg: unknown): string };
  events: {
    on(type: string, cb: (payload: unknown) => void): () => void;
    emit(type: string, payload?: unknown): void;
    known(): { type: string; lastPayload?: unknown }[];
    describe?(type: string, meta: Record<string, unknown>): void;
  };
  mcp: {
    registerTool(spec: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      handler: (args: unknown) => unknown | Promise<unknown>;
      timeoutMs?: number;
    }): Promise<void>;
  };
  rules: {
    create(
      draft: { name: string; pattern: string; phase: string; script: string },
      options?: { open?: boolean },
    ): Promise<string>;
    remove(id: string): Promise<void>;
    list(): Promise<{ id: string; name: string }[]>;
  };
  registerFlowAction(action: {
    id: string;
    label: string;
    run(flow: HostFlow): void;
  }): void;
  ui: {
    MethodBadge: React.ComponentType<{ method: string; className?: string }>;
    Button: React.ComponentType<Record<string, unknown>>;
    Input: React.ComponentType<Record<string, unknown>>;
    Select: React.ComponentType<Record<string, unknown>>;
  };
  registerMode(mode: {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    component: React.ComponentType;
  }): void;
  setMode(id: string): void;
  log(...args: unknown[]): void;
}

declare global {
  interface Window {
    __TRAWL__?: TrawlHost;
  }
}
