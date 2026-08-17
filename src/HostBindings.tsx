import type { Spec } from "./model";
import type { SpecStore } from "./store";

const host = window.__TRAWL__!;
const { useState } = host.react;

/** Which hosts this spec covers. Relative servers ("/api/v3") leave this empty,
 *  and an unbound spec matches no traffic at all — so it has to be editable. */
export function HostBindings({ spec, store }: { spec: Spec; store: SpecStore }) {
  const [draft, setDraft] = useState(spec.hosts.join(", "));
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="text-xs underline" onClick={() => setOpen(true)}>
        {spec.hosts.length > 0 ? spec.hosts.join(", ") : "no host bound — set one"}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <input
        className="bg-transparent border border-border rounded px-2 py-0.5 text-xs w-72"
        value={draft}
        placeholder="api.example.com, staging.example.com"
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        className="text-xs underline"
        onClick={() => {
          const hosts = draft
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean);
          void store.setHosts(spec.id, hosts);
          setOpen(false);
        }}
      >
        Save
      </button>
    </span>
  );
}
