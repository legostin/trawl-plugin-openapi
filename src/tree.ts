import type { Endpoint } from "./model";

export interface TagGroup {
  tag: string;
  endpoints: Endpoint[];
}

const UNTAGGED = "Untagged";

const byPathThenMethod = (a: Endpoint, b: Endpoint) =>
  a.pathTemplate.localeCompare(b.pathTemplate) || a.method.localeCompare(b.method);

/** Tags in alphabetical order, untagged operations last so they stay visible. */
export function groupByTag(endpoints: Endpoint[]): TagGroup[] {
  const groups = new Map<string, Endpoint[]>();
  for (const e of endpoints) {
    const tags = e.tags.length > 0 ? e.tags : [UNTAGGED];
    for (const tag of tags) {
      const list = groups.get(tag) ?? [];
      list.push(e);
      groups.set(tag, list);
    }
  }
  const untagged = groups.get(UNTAGGED);
  groups.delete(UNTAGGED);
  const out = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, list]) => ({ tag, endpoints: [...list].sort(byPathThenMethod) }));
  if (untagged) out.push({ tag: UNTAGGED, endpoints: [...untagged].sort(byPathThenMethod) });
  return out;
}

export function filterEndpoints(endpoints: Endpoint[], query: string): Endpoint[] {
  const q = query.trim().toLowerCase();
  if (!q) return endpoints;
  return endpoints.filter((e) =>
    [e.method, e.pathTemplate, e.operationId ?? "", e.summary ?? "", ...e.tags]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}
