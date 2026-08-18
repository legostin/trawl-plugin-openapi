import { getEngine } from "./engine";
import { requestSelection } from "./selection";
import type { HostFlow } from "./trawl";

const host = window.__TRAWL__!;

/** What the OpenAPI plugin knows about this exact request, shown where the
 *  user is already looking rather than one mode away. */
export function FlowPanel({ flow }: { flow: HostFlow }) {
  const engine = getEngine();
  const verdict = engine?.verdictFor(flow.id);

  if (!verdict) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        Not measured against any spec. Bind a spec to this host in the OpenAPI mode.
      </p>
    );
  }

  return (
    <div className="p-3 space-y-2 text-xs">
      <div>
        {verdict.endpointKey ? (
          <button
            className="underline"
            onClick={() => {
              if (verdict.specId && verdict.endpointKey) {
                requestSelection({ specId: verdict.specId, endpointKey: verdict.endpointKey });
              }
              host.setMode("openapi");
            }}
          >
            {verdict.endpointKey}
          </button>
        ) : (
          <span className="text-amber-400">
            {verdict.status === "undocumented"
              ? "No endpoint documents this call."
              : "No spec is bound to this host."}
          </span>
        )}
      </div>

      {verdict.violations.length === 0 && verdict.endpointKey && (
        <p className="text-emerald-400">Conforms to the schema.</p>
      )}
      {verdict.violations.map((v, i) => (
        <div key={i} className="font-mono">
          <span className="text-muted-foreground">{v.where}</span> {v.pointer}
          <span className="text-red-400">
            {" "}
            expected {v.expected}, got {v.actual}
          </span>
        </div>
      ))}
      {verdict.notes.map((n) => (
        <p key={n} className="text-amber-400/80">
          {n}
        </p>
      ))}
    </div>
  );
}
