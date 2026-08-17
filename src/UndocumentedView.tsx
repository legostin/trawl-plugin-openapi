import type { Engine } from "./engine";

export function UndocumentedView({ engine }: { engine: Engine }) {
  const rows = engine.aggregates.undocumented();
  const dropped = engine.aggregates.droppedUndocumented();

  if (rows.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Every call on a bound host matched an endpoint in this window.
      </p>
    );
  }

  return (
    <div className="p-3">
      <p className="text-sm mb-3">
        {rows.length} path{rows.length === 1 ? "" : "s"} called that no spec documents
      </p>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.method} ${r.host}${r.path}`}>
              <td className="py-0.5 pr-2 text-muted-foreground">{r.method}</td>
              <td className="font-mono">
                {r.host}
                {r.path}
              </td>
              <td className="text-right">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dropped > 0 && (
        <p className="mt-2 text-xs text-amber-400/80">
          {dropped} further call{dropped === 1 ? "" : "s"} were not listed — the tally stops at 200
          distinct paths.
        </p>
      )}
    </div>
  );
}
