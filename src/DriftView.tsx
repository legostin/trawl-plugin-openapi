import type { Engine } from "./engine";
import type { Spec } from "./model";

export function DriftView({ engine, spec }: { engine: Engine; spec: Spec }) {
  const keys = engine.drift.keys().sort();
  const changes = spec.lastDiff ?? [];

  return (
    <div className="p-3 space-y-4 text-sm">
      <section>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          fields — spec versus reality
        </div>
        {keys.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Nothing measured yet. Drift is read from live responses only — history keeps no bodies.
          </p>
        )}
        {keys.map((key) => {
          const report = engine.drift.report(key);
          if (!report || (report.undocumented.length === 0 && report.neverSeen.length === 0)) {
            return null;
          }
          return (
            <div key={key} className="mb-2">
              <div className="font-mono text-xs">
                {key}
                <span className="text-muted-foreground">
                  {" "}
                  · {report.samples} response{report.samples === 1 ? "" : "s"}
                </span>
              </div>
              {report.undocumented.map((p) => (
                <div key={`u${p}`} className="font-mono text-xs pl-3 text-amber-400">
                  {p} <span className="text-muted-foreground">arrives, not in the spec</span>
                </div>
              ))}
              {report.neverSeen.map((p) => (
                <div key={`n${p}`} className="font-mono text-xs pl-3 text-muted-foreground">
                  {p} documented, never seen
                </div>
              ))}
              {report.dropped > 0 && (
                <p className="pl-3 text-xs text-amber-400/80">
                  {report.dropped} more paths were dropped at the 200-path cap.
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          last refresh
        </div>
        {changes.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {spec.lastDiffAt
              ? "The last refresh changed nothing."
              : "This spec has not been refreshed yet."}
          </p>
        ) : (
          changes.map((c, i) => (
            <div key={i} className="text-xs leading-5">
              <span className={c.breaking ? "text-red-400" : "text-muted-foreground"}>
                {c.breaking ? "breaking" : "safe"}
              </span>{" "}
              <span className="font-mono">{c.key}</span> — {c.detail}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
