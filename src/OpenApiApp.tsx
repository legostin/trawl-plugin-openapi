import { AddSpec } from "./AddSpec";
import { EndpointTree } from "./EndpointTree";
import { EndpointView } from "./EndpointView";
import type { Endpoint, Spec } from "./model";
import { SpecStore } from "./store";

const host = window.__TRAWL__!;
const { useEffect, useMemo, useState } = host.react;

export function OpenApiApp() {
  const store = useMemo(() => new SpecStore(host), []);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const off = store.subscribe(() => setSpecs([...store.list()]));
    void store.load();
    return off;
  }, [store]);

  // Follow the active project: specs are stored per project by the host.
  useEffect(() => host.projects.onChange(() => void store.load()), [store]);

  const active = specs.find((s) => s.id === activeId) ?? specs[0] ?? null;

  if (adding || specs.length === 0) {
    return (
      <div className="h-full overflow-auto">
        {specs.length === 0 && !adding && (
          <p className="p-4 text-sm text-muted-foreground">
            No spec loaded yet. Add one from a URL, a file, or paste it.
          </p>
        )}
        <AddSpec store={store} onDone={() => setAdding(false)} />
        {specs.length > 0 && (
          <button className="ml-4 text-sm underline" onClick={() => setAdding(false)}>
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm">
        <select
          className="bg-transparent"
          value={active?.id}
          onChange={(e) => {
            setActiveId(e.target.value);
            setSelected(null);
          }}
        >
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} {s.version && `· ${s.version}`}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-xs">
          {active?.endpoints.length} endpoints · {active?.hosts.join(", ") || "no host bound"}
        </span>
        <div className="ml-auto flex gap-3 text-xs">
          {active?.source.kind === "url" && (
            <button className="underline" onClick={() => void store.refresh(active.id)}>
              Refresh
            </button>
          )}
          <button className="underline" onClick={() => setAdding(true)}>
            Add spec
          </button>
          <button
            className="underline"
            onClick={() => {
              if (active) void store.remove(active.id);
              setSelected(null);
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {store.loadError && (
        <p className="px-3 py-2 text-xs text-red-400 border-b border-border">{store.loadError}</p>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="w-72 border-r border-border overflow-auto">
          <EndpointTree
            endpoints={active?.endpoints ?? []}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <EndpointView endpoint={selected} />
        </div>
      </div>
    </div>
  );
}
