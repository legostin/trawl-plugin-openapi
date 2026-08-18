import { coverageRows, coverageSummary } from "./coverage";
import type { Engine } from "./engine";
import { endpointKey, type Endpoint, type Spec } from "./model";
import { HealthBar, STATUS, statusOf } from "./status";
import { groupByTag } from "./tree";

const Tile = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
  <div className="rounded-md border border-border bg-card px-3 py-2">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-xl font-semibold tabular-nums leading-tight ${tone ?? ""}`}>{value}</div>
  </div>
);

/** The five numbers that answer "what is going on with this API right now". */
export function MetricRow({ engine, spec }: { engine: Engine; spec: Spec }) {
  const rows = coverageRows(spec, (key) => engine.aggregates.forEndpoint(spec.id, key));
  const summary = coverageSummary(rows);
  const totals = engine.aggregates.totals();
  const undocumented = engine.aggregates.undocumented().length;
  const driftFields = engine.drift
    .keys()
    .reduce((n, key) => n + (engine.drift.report(key)?.undocumented.length ?? 0), 0);

  return (
    <div className="grid grid-cols-5 gap-2">
      <Tile label="coverage" value={`${summary.called}/${summary.total}`} />
      <Tile label="calls" value={totals.calls} />
      <Tile
        label="violations"
        value={totals.violations}
        tone={totals.violations > 0 ? STATUS.violations.text : undefined}
      />
      <Tile
        label="not in spec"
        value={undocumented}
        tone={undocumented > 0 ? STATUS.drift.text : undefined}
      />
      <Tile
        label="drift fields"
        value={driftFields}
        tone={driftFields > 0 ? STATUS.drift.text : undefined}
      />
    </div>
  );
}

/** Health per tag: how much of each group is broken, healthy, or untouched. */
export function TagHealth({ engine, spec }: { engine: Engine; spec: Spec }) {
  const groups = groupByTag(spec.endpoints);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        let ok = 0;
        let bad = 0;
        let idle = 0;
        for (const e of group.endpoints) {
          const s = engine.aggregates.forEndpoint(spec.id, endpointKey(e));
          if (s.violations > 0) bad += 1;
          else if (s.calls > 0) ok += 1;
          else idle += 1;
        }
        return (
          <div key={group.tag} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 truncate text-muted-foreground">{group.tag}</span>
            <HealthBar ok={ok} bad={bad} idle={idle} />
            <span className="w-6 text-right tabular-nums text-muted-foreground">
              {group.endpoints.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One square per endpoint: the whole spec at a glance. */
export function EndpointGrid({
  engine,
  spec,
  onSelect,
}: {
  engine: Engine;
  spec: Spec;
  onSelect: (e: Endpoint) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {spec.endpoints.map((e) => {
        const key = endpointKey(e);
        const stats = engine.aggregates.forEndpoint(spec.id, key);
        const status = statusOf(stats);
        return (
          <button
            key={key}
            onClick={() => onSelect(e)}
            title={`${key} — ${stats.calls} call${stats.calls === 1 ? "" : "s"}, ${STATUS[status].label}`}
            className={`h-3 w-3 rounded-[2px] ${STATUS[status].bg} hover:ring-1 hover:ring-foreground/40`}
          />
        );
      })}
    </div>
  );
}
