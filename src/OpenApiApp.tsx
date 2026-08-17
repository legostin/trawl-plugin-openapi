import { AddSpec } from "./AddSpec";
import { EndpointTree } from "./EndpointTree";
import { EndpointView } from "./EndpointView";
import { HostBindings } from "./HostBindings";
import { RealityPanel } from "./RealityPanel";
import { getEngine } from "./engine";
import type { Endpoint, Spec } from "./model";
import { endpointKey } from "./model";
import { onSelection, takeSelection } from "./selection";
import type { SessionWindow } from "./session";

const host = window.__TRAWL__!;
const { useEffect, useState } = host.react;

const WINDOWS: { value: SessionWindow; label: string }[] = [
  { value: "capture", label: "Since capture started" },
  { value: "project", label: "Whole project" },
  { value: "filter", label: "Current traffic filter" },
];

export function OpenApiApp() {
  const engine = getEngine();
  const [, bump] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => engine?.subscribe(() => bump((n) => n + 1)), [engine]);

  // A flow action may have asked for an endpoint before this mode was mounted.
  useEffect(() => {
    const show = (s: { specId: string; endpointKey: string }) => {
      const spec = engine?.store.list().find((x) => x.id === s.specId);
      const ep = spec?.endpoints.find((e) => endpointKey(e) === s.endpointKey);
      if (spec && ep) {
        setActiveId(spec.id);
        setSelected(ep);
      }
    };
    const pending = takeSelection();
    if (pending) show(pending);
    return onSelection(show);
  }, [engine]);

  if (!engine) return <p className="p-4 text-sm text-muted-foreground">The plugin did not start.</p>;

  const specs: Spec[] = engine.store.list();
  const active = specs.find((s) => s.id === activeId) ?? specs[0] ?? null;

  if (adding || specs.length === 0) {
    return (
      <div className="h-full overflow-auto">
        {specs.length === 0 && !adding && (
          <p className="p-4 text-sm text-muted-foreground">
            No spec loaded yet. Add one from a URL, a file, or paste it.
          </p>
        )}
        <AddSpec store={engine.store} onDone={() => setAdding(false)} />
        {specs.length > 0 && (
          <button className="ml-4 text-sm underline" onClick={() => setAdding(false)}>
            Cancel
          </button>
        )}
      </div>
    );
  }

  const totals = engine.aggregates.totals();
  const undocumented = engine.aggregates.undocumented();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-sm">
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
        {active && <HostBindings key={active.id} spec={active} store={engine.store} />}
        <select
          className="bg-transparent text-xs"
          value={engine.window}
          onChange={(e) => engine.setWindow(e.target.value as SessionWindow)}
        >
          {WINDOWS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {engine.backfilling
            ? "reading history…"
            : `${totals.calls} calls · ${totals.violations} with violations`}
          {undocumented.length > 0 && ` · ${undocumented.length} undocumented`}
        </span>
        <div className="ml-auto flex gap-3 text-xs">
          {active?.source.kind === "url" && (
            <button className="underline" onClick={() => void engine.store.refresh(active.id)}>
              Refresh
            </button>
          )}
          <button className="underline" onClick={() => setAdding(true)}>
            Add spec
          </button>
          <button
            className="underline"
            onClick={() => {
              if (active) void engine.store.remove(active.id);
              setSelected(null);
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {engine.store.loadError && (
        <p className="px-3 py-2 text-xs text-red-400 border-b border-border">
          {engine.store.loadError}
        </p>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="w-72 border-r border-border overflow-auto">
          <EndpointTree
            endpoints={active?.endpoints ?? []}
            selected={selected}
            onSelect={setSelected}
            stats={(e) => (active ? engine.aggregates.forEndpoint(active.id, endpointKey(e)) : undefined)}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <EndpointView endpoint={selected} />
        </div>
        <div className="w-80 border-l border-border overflow-auto">
          <RealityPanel engine={engine} spec={active} endpoint={selected} />
        </div>
      </div>
    </div>
  );
}
