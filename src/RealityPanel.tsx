import type { Engine } from "./engine";
import type { Endpoint, Spec, Verdict } from "./model";
import { endpointKey } from "./model";
import { TONE } from "./tone";

// No host API is needed here: everything on screen comes from the engine.

const STATUS_COLOR: Record<string, string | undefined> = {
  ok: TONE.ok,
  violations: TONE.violation,
  undocumented: TONE.drift,
  unmapped: undefined,
};

function VerdictRow({ v }: { v: Verdict }) {
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="text-muted-foreground">{new Date(v.ts).toLocaleTimeString()}</span>
      <span style={{ color: STATUS_COLOR[v.status] }}>{v.httpStatus ?? "—"}</span>
      <span className="truncate">
        {v.violations.length > 0 ? `${v.violations.length} violation(s)` : v.status}
      </span>
    </div>
  );
}

export function RealityPanel({
  engine,
  spec,
  endpoint,
}: {
  engine: Engine;
  spec: Spec | null;
  endpoint: Endpoint | null;
}) {
  if (!spec || !endpoint) return null;
  const key = endpointKey(endpoint);
  const stats = engine.aggregates.forEndpoint(spec.id, key);
  const recent = engine.recent(spec.id, key);
  const notes = [...new Set(recent.flatMap((v) => v.notes))];
  const violations = recent.flatMap((v) => v.violations);

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">reality</div>

      <div>
        {stats.calls === 0 ? (
          <span className="text-muted-foreground">
            {spec.hosts.length === 0
              ? "No host bound — this spec is matched against nothing."
              : "Not called in this window."}
          </span>
        ) : (
          <span>
            {stats.calls} call{stats.calls === 1 ? "" : "s"} ·{" "}
            <span style={{ color: stats.violations > 0 ? TONE.violation : TONE.ok }}>
              {stats.violations > 0 ? `${stats.violations} with violations` : "all conform"}
            </span>
          </span>
        )}
      </div>

      {violations.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            violations
          </div>
          {violations.slice(0, 20).map((v, i) => (
            <div key={i} className="font-mono text-xs leading-5">
              <span className="text-muted-foreground">{v.where}</span> {v.pointer}
              <span style={{ color: TONE.violation }}>
                {" "}
                expected {v.expected}, got {v.actual}
              </span>
            </div>
          ))}
        </section>
      )}

      {notes.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            not checked
          </div>
          {notes.map((n) => (
            <p key={n} className="text-xs" style={{ color: TONE.drift, opacity: 0.85 }}>
              {n}
            </p>
          ))}
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            recent calls
          </div>
          {recent.map((v) => (
            <VerdictRow key={v.flowId} v={v} />
          ))}
        </section>
      )}
    </div>
  );
}
