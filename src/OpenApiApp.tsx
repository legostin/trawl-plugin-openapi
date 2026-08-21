import { AddSpec } from "./AddSpec";
import { CoverageView } from "./CoverageView";
import { DriftView } from "./DriftView";
import { UndocumentedView } from "./UndocumentedView";
import { EndpointTree } from "./EndpointTree";
import { EndpointView } from "./EndpointView";
import { HostBindings } from "./HostBindings";
import { RealityPanel } from "./RealityPanel";
import { MetricRow } from "./Summary";
import { TONE } from "./tone";
import { getEngine, type Engine } from "./engine";
import type { Endpoint, Spec } from "./model";
import { endpointKey } from "./model";
import { hasCollectionImport, importCollection, watchContracts } from "./neighbours";
import { onSelection, takeSelection } from "./selection";
import { buildRequest } from "./tryit";
import type { SessionWindow } from "./session";

const host = window.__TRAWL__!;
const { useEffect, useState } = host.react;

const WINDOWS: { value: SessionWindow; label: string }[] = [
  { value: "capture", label: "Since capture started" },
  { value: "project", label: "Whole project" },
  { value: "filter", label: "Current traffic filter" },
];

/** The spec's actions. On a narrow window the host's Toolbar folds what does
 *  not fit into a "⋯" menu; on an older host they stay plain buttons. */
function HeaderActions({
  engine,
  active,
  onAdd,
  onRemoved,
}: {
  engine: Engine;
  active: Spec | null;
  onAdd: () => void;
  onRemoved: () => void;
}) {
  const items = [
    ...(active?.source.kind === "url"
      ? [
          {
            id: "refresh",
            label: "Refresh",
            priority: 3,
            onClick: () => void engine.store.refresh(active.id),
          },
        ]
      : []),
    { id: "add", label: "Add spec", priority: 2, onClick: onAdd },
    ...(hasCollectionImport() && active
      ? [
          {
            id: "import",
            label: "Import as collection",
            priority: 1,
            onClick: () =>
              importCollection(
                active.title,
                active.endpoints.map((e) => ({
                  name: `${e.method} ${e.pathTemplate}`,
                  ...buildRequest(active, e, engine.lastCall(active.id, endpointKey(e))),
                })),
              ),
          },
        ]
      : []),
    {
      id: "remove",
      label: "Remove",
      priority: 0,
      onClick: () => {
        if (active) void engine.store.remove(active.id);
        onRemoved();
      },
    },
  ];

  const Toolbar = host.ui.Toolbar;
  if (Toolbar) return <Toolbar items={items} />;
  return (
    <div className="flex gap-3 text-xs">
      {items.map((i) => (
        <button key={i.id} className="underline" onClick={i.onClick}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function OpenApiApp() {
  const engine = getEngine();
  const [, bump] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"browse" | "coverage" | "undocumented" | "drift">("browse");

  const showEndpoint = (e: Endpoint) => {
    setSelected(e);
    setTab("browse");
  };

  useEffect(() => engine?.subscribe(() => bump((n) => n + 1)), [engine]);
  // Schema Check publishes its contract list; the badge follows it.
  useEffect(() => watchContracts(() => bump((n) => n + 1)), []);

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
        <div className="ml-auto min-w-0">
          <HeaderActions
            engine={engine}
            active={active}
            onAdd={() => setAdding(true)}
            onRemoved={() => setSelected(null)}
          />
        </div>
      </div>

      {active && (
        <div className="px-3 py-2 border-b border-border">
          <MetricRow engine={engine} spec={active} />
        </div>
      )}

      <div className="flex gap-3 px-3 py-1.5 border-b border-border text-xs">
        {(["browse", "coverage", "undocumented", "drift"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "text-foreground" : "text-muted-foreground"}
          >
            {t === "undocumented" && undocumented.length > 0
              ? `undocumented (${undocumented.length})`
              : t}
          </button>
        ))}
      </div>

      {engine.store.loadError && (
        <p className="px-3 py-2 text-xs border-b border-border" style={{ color: TONE.violation }}>
          {engine.store.loadError}
        </p>
      )}

      {tab === "browse" ? (
        <div className="flex-1 min-h-0 flex">
          <div className="w-72 border-r border-border overflow-auto">
            <EndpointTree
              endpoints={active?.endpoints ?? []}
              selected={selected}
              onSelect={setSelected}
              stats={(e) =>
                active ? engine.aggregates.forEndpoint(active.id, endpointKey(e)) : undefined
              }
            />
          </div>
          <div className="flex-1 overflow-auto">
            <EndpointView engine={engine} spec={active} endpoint={selected} />
          </div>
          <div className="w-80 border-l border-border overflow-auto">
            <RealityPanel engine={engine} spec={active} endpoint={selected} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "coverage" && active && (
            <CoverageView engine={engine} spec={active} onSelect={showEndpoint} />
          )}
          {tab === "undocumented" && <UndocumentedView engine={engine} />}
          {tab === "drift" && active && <DriftView engine={engine} spec={active} />}
        </div>
      )}
    </div>
  );
}
