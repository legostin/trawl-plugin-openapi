import type { TrawlHost } from "./trawl";
import { applyVars } from "./vars";

export type FetchResult = { ok: true; text: string } | { ok: false; error: string };

/** Fetch a spec document. Deliberately not through the capture proxy: the
 *  plugin must not add traffic to the history it is there to analyse. */
export async function fetchSpecText(
  host: TrawlHost,
  url: string,
  headers: [string, string][],
): Promise<FetchResult> {
  const env = host.projects.active()?.env ?? [];
  const resolved: [string, string][] = headers.map(([k, v]) => [k, applyVars(v, env)]);
  const res = await host.http.send(
    { method: "GET", url: applyVars(url, env), headers: resolved, body: "" },
    false,
  );
  if (res.error) return { ok: false, error: res.error };
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, error: `The server answered ${res.status}.` };
  }
  return { ok: true, text: res.body };
}
