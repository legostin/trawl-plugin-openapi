import { coverageRows, coverageSummary } from "./coverage";
import type { Engine } from "./engine";
import type { Endpoint, Spec } from "./model";
import { EndpointGrid, TagHealth } from "./Summary";
import { TONE } from "./tone";

const host = window.__TRAWL__!;
const { MethodBadge } = host.ui;

const STATE_COLOR = {
  violations: TONE.violation,
  never: undefined,
  called: TONE.ok,
} as const;

// All three take the count so `LABEL[state](n)` type-checks as one signature.
const LABEL = {
  violations: (n: number) => `${n} violation${n === 1 ? "" : "s"}`,
  never: (_n: number) => "never called",
  called: (_n: number) => "ok",
} as const;

export function CoverageView({
  engine,
  spec,
  onSelect,
}: {
  engine: Engine;
  spec: Spec;
  onSelect: (e: Endpoint) => void;
}) {
  const rows = coverageRows(spec, (key) => engine.aggregates.forEndpoint(spec.id, key));
  const summary = coverageSummary(rows);

  return (
    <div className="p-3">
      <p className="text-sm">
        {summary.called} of {summary.total} endpoints called
        <span className="text-muted-foreground"> · {summary.percent}% in this window</span>
      </p>
      <div className="my-3 space-y-3">
        <EndpointGrid engine={engine} spec={spec} onSelect={onSelect} />
        <TagHealth engine={engine} spec={spec} />
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="text-left font-normal py-1">endpoint</th>
            <th className="text-right font-normal">calls</th>
            <th className="text-left font-normal pl-3">state</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="cursor-pointer hover:bg-accent/40"
              onClick={() => onSelect(r.endpoint)}
            >
              <td className="py-0.5 flex items-center gap-2">
                <MethodBadge method={r.endpoint.method} />
                <span className="font-mono">{r.endpoint.pathTemplate}</span>
              </td>
              <td className="text-right">{r.calls || ""}</td>
              <td className="pl-3" style={{ color: STATE_COLOR[r.state] }}>{LABEL[r.state](r.violations)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
