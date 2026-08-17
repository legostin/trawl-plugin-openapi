import type { FlowRow, HostFlow } from "./trawl";

/** One shape for both traffic sources. `hasBodies` is false for history rows,
 *  which carry no headers or body at all — nothing about them may be claimed. */
export interface FlowSample {
  id: number;
  ts: number;
  method: string;
  host: string;
  /** Without the query string. */
  path: string;
  query: [string, string][];
  status?: number;
  requestContentType?: string;
  requestBody?: string;
  responseContentType?: string;
  responseBody?: string;
  hasBodies: boolean;
}

export function headerValue(headers: [string, string][], name: string): string | undefined {
  const wanted = name.toLowerCase();
  return headers.find(([k]) => k.toLowerCase() === wanted)?.[1];
}

/** "application/json; charset=utf-8" → "application/json". */
function mime(value: string | undefined): string | undefined {
  return value?.split(";")[0].trim().toLowerCase() || undefined;
}

function splitPath(pathWithQuery: string): { path: string; query: [string, string][] } {
  const [path, search = ""] = pathWithQuery.split("?");
  const query: [string, string][] = [];
  for (const [k, v] of new URLSearchParams(search)) query.push([k, v]);
  return { path, query };
}

export function sampleFromFlow(flow: HostFlow, bodyText: (msg: unknown) => string): FlowSample {
  const { path, query } = splitPath(flow.url.path);
  const response = flow.response;
  return {
    id: flow.id,
    ts: flow.timestamp,
    method: flow.method.toUpperCase(),
    host: flow.url.host,
    path,
    query,
    status: response?.status,
    requestContentType: mime(headerValue(flow.request.headers, "content-type")),
    requestBody: bodyText(flow.request) || undefined,
    responseContentType: response ? mime(headerValue(response.headers, "content-type")) : undefined,
    responseBody: response ? bodyText(response) || undefined : undefined,
    hasBodies: true,
  };
}

export function sampleFromRow(row: FlowRow): FlowSample {
  const { path, query } = splitPath(row.path);
  return {
    id: row.id,
    ts: row.ts,
    method: row.method.toUpperCase(),
    host: row.host,
    path,
    query,
    status: row.status ?? undefined,
    hasBodies: false,
  };
}
