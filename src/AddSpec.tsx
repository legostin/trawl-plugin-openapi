import type { SpecStore } from "./store";

const host = window.__TRAWL__!;
const { useState } = host.react;

type Tab = "url" | "file" | "text";

export function AddSpec({ store, onDone }: { store: SpecStore; onDone: () => void }) {
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [header, setHeader] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (r: { ok: true } | { ok: false; error: string }) => {
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.error);
  };

  const addUrl = async () => {
    setBusy(true);
    setError(null);
    // "authorization: Bearer {{token}}" — one header covers almost every
    // private spec; project variables are substituted before sending.
    const headers: [string, string][] = [];
    const colon = header.indexOf(":");
    if (colon > 0) headers.push([header.slice(0, colon).trim(), header.slice(colon + 1).trim()]);
    finish(await store.addFromUrl(url.trim(), headers));
  };

  const addText = async () => {
    setBusy(true);
    setError(null);
    finish(await store.add({ kind: "text", ref: "pasted" }, text));
  };

  const addFile = async (file: File) => {
    setBusy(true);
    setError(null);
    finish(await store.add({ kind: "file", ref: file.name }, await file.text()));
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2 text-xs">
        {(["url", "file", "text"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2 py-1 rounded ${tab === t ? "bg-accent" : "text-muted-foreground"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <div className="space-y-2">
          <input
            className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm"
            placeholder="https://api.example.com/openapi.json"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm"
            placeholder="authorization: Bearer {{token}}   (optional)"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
          />
          <button className="text-sm underline" disabled={busy} onClick={addUrl}>
            {busy ? "Loading…" : "Load"}
          </button>
        </div>
      )}

      {tab === "file" && (
        <input
          type="file"
          accept=".json,.yaml,.yml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addFile(file);
          }}
        />
      )}

      {tab === "text" && (
        <div className="space-y-2">
          <textarea
            className="w-full h-48 bg-transparent border border-border rounded px-2 py-1 font-mono text-xs"
            placeholder="Paste openapi.json or openapi.yaml"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="text-sm underline" disabled={busy} onClick={addText}>
            {busy ? "Loading…" : "Add"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
