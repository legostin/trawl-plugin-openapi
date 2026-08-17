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
