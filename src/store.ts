import type { Spec, SpecSource } from "./model";
import { uid } from "./model";
import { parseSpec } from "./parse";
import { fetchSpecText } from "./sources";
import { decodeSpecs, encodeSpecs } from "./storage";
import type { TrawlHost } from "./trawl";

const KEY = "specs";

export type AddResult = { ok: true; spec: Spec } | { ok: false; error: string };

/** Servers are URLs; traffic is matched by host name. */
export function hostsOf(servers: string[]): string[] {
  const hosts = new Set<string>();
  for (const server of servers) {
    try {
      hosts.add(new URL(server).host);
    } catch {
      // A relative or templated server URL ("/v2", "{scheme}://…") has no host
      // to bind; the user supplies one in the spec's settings.
    }
  }
  return [...hosts];
}

/** The plugin's spec list: persisted per project by the host's storage. */
export class SpecStore {
  private specs: Spec[] = [];
  private listeners = new Set<() => void>();
  /** Set when the stored payload could not be read — surfaced, never hidden. */
  loadError?: string;

  constructor(private host: TrawlHost) {}

  list(): Spec[] {
    return this.specs;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit() {
    this.listeners.forEach((cb) => cb());
  }

  private async persist() {
    await this.host.storage.set(KEY, encodeSpecs(this.specs));
  }

  async load(): Promise<void> {
    const { specs, error } = decodeSpecs(await this.host.storage.get(KEY));
    this.specs = specs;
    this.loadError = error;
    this.emit();
  }

  /** Parse `text` and keep it. `source` records where it came from. */
  async add(source: SpecSource, text: string): Promise<AddResult> {
    const parsed = parseSpec(text);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const spec: Spec = {
      ...parsed.doc,
      id: uid("spec"),
      source,
      hosts: hostsOf(parsed.doc.servers),
      fetchedAt: Date.now(),
      raw: text,
    };
    this.specs = [...this.specs, spec];
    await this.persist();
    this.emit();
    return { ok: true, spec };
  }

  async addFromUrl(url: string, headers: [string, string][]): Promise<AddResult> {
    const fetched = await fetchSpecText(this.host, url, headers);
    if (!fetched.ok) return fetched;
    return this.add({ kind: "url", ref: url, headers }, fetched.text);
  }

  /** Re-fetch a URL-sourced spec, keeping its id and host bindings. */
  async refresh(id: string): Promise<AddResult> {
    const current = this.specs.find((s) => s.id === id);
    if (!current) return { ok: false, error: "No such spec." };
    if (current.source.kind !== "url") {
      return { ok: false, error: "Only URL specs can be refreshed." };
    }
    const fetched = await fetchSpecText(this.host, current.source.ref, current.source.headers ?? []);
    if (!fetched.ok) return fetched;
    const parsed = parseSpec(fetched.text);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const updated: Spec = { ...current, ...parsed.doc, fetchedAt: Date.now(), raw: fetched.text };
    this.specs = this.specs.map((s) => (s.id === id ? updated : s));
    await this.persist();
    this.emit();
    return { ok: true, spec: updated };
  }

  async remove(id: string): Promise<void> {
    this.specs = this.specs.filter((s) => s.id !== id);
    await this.persist();
    this.emit();
  }

  async setHosts(id: string, hosts: string[]): Promise<void> {
    this.specs = this.specs.map((s) => (s.id === id ? { ...s, hosts } : s));
    await this.persist();
    this.emit();
  }
}
