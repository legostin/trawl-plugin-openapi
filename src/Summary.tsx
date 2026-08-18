import { coverageRows, coverageSummary } from "./coverage";
import type { Engine } from "./engine";
import { endpointKey, type Endpoint, type Spec } from "./model";
import { HealthBar, STATUS, statusOf } from "./status";
import { TONE } from "./tone";
import { groupByTag } from "./tree";

/** One number and its name, on one line — the row has to fit above the tabs. */
function Tile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 6,
        border: "1px solid var(--border, #232a36)",
      }}
    >
      <span style={{ fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.6 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color }}>
        {value}
      </span>
    </span>
  );
}

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <Tile label="coverage" value={`${summary.called}/${summary.total}`} />
      <Tile label="calls" value={totals.calls} />
      <Tile
        label="violations"
        value={totals.violations}
        color={totals.violations > 0 ? TONE.violation : undefined}
      />
      <Tile
        label="not in spec"
        value={undocumented}
        color={undocumented > 0 ? TONE.drift : undefined}
      />
      <Tile label="drift" value={driftFields} color={driftFields > 0 ? TONE.drift : undefined} />
    </div>
  );
}

/** Health per tag: how much of each group is broken, healthy, or untouched. */
export function TagHealth({ engine, spec }: { engine: Engine; spec: Spec }) {
  const groups = groupByTag(spec.endpoints);
  if (groups.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
          <div key={group.tag} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span className="text-muted-foreground" style={{ width: 96 }}>
              {group.tag}
            </span>
            <HealthBar ok={ok} bad={bad} idle={idle} />
            <span className="text-muted-foreground" style={{ width: 24, textAlign: "right" }}>
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {spec.endpoints.map((e) => {
        const key = endpointKey(e);
        const stats = engine.aggregates.forEndpoint(spec.id, key);
        const status = statusOf(stats);
        return (
          <button
            key={key}
            onClick={() => onSelect(e)}
            title={`${key} — ${stats.calls} call${stats.calls === 1 ? "" : "s"}, ${STATUS[status].label}`}
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              background: STATUS[status].color,
              opacity: status === "never" ? 0.35 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
