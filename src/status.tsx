import type { EndpointStats } from "./session";

export type Status = "violations" | "ok" | "never" | "drift";

/**
 * Status colours are reserved and never stand alone: every use pairs the
 * colour with a glyph and a word, so the screen still reads for someone who
 * cannot tell red from green.
 */
export const STATUS: Record<Status, { text: string; bg: string; glyph: string; label: string }> = {
  violations: { text: "text-red-400", bg: "bg-red-400", glyph: "✕", label: "violations" },
  ok: { text: "text-emerald-400", bg: "bg-emerald-400", glyph: "✓", label: "conforms" },
  drift: { text: "text-amber-400", bg: "bg-amber-400", glyph: "△", label: "drift" },
  never: { text: "text-muted-foreground", bg: "bg-muted-foreground/30", glyph: "·", label: "never called" },
};

export function statusOf(stats: EndpointStats, hasDrift = false): Status {
  if (stats.violations > 0) return "violations";
  if (stats.calls === 0) return "never";
  return hasDrift ? "drift" : "ok";
}

/** A three-pixel bar carrying the row's state, read before any text is. */
export function StatusStrip({ status }: { status: Status }) {
  return (
    <span
      className={`w-[3px] self-stretch rounded-sm ${STATUS[status].bg}`}
      title={STATUS[status].label}
      aria-label={STATUS[status].label}
    />
  );
}

/** Calls over the session window. One series, so no legend — the row names it. */
export function Sparkline({ moments, buckets = 12 }: { moments: number[]; buckets?: number }) {
  if (moments.length === 0) return null;
  const first = moments[0];
  const last = moments[moments.length - 1];
  const span = Math.max(1, last - first);
  const counts = new Array(buckets).fill(0) as number[];
  for (const ts of moments) {
    const slot = Math.min(buckets - 1, Math.floor(((ts - first) / span) * buckets));
    counts[slot] += 1;
  }
  const peak = Math.max(...counts, 1);

  return (
    <span
      className="inline-flex h-3 items-end gap-px"
      title={`${moments.length} call${moments.length === 1 ? "" : "s"} over the window`}
    >
      {counts.map((n, i) => (
        <span
          key={i}
          className="w-[3px] rounded-t-sm bg-primary/70"
          style={{ height: `${Math.max(1, Math.round((n / peak) * 12))}px` }}
        />
      ))}
    </span>
  );
}

/** Share of an endpoint group by state — one bar, three segments, 2px apart. */
export function HealthBar({ ok, bad, idle }: { ok: number; bad: number; idle: number }) {
  const total = Math.max(1, ok + bad + idle);
  const seg = (n: number, cls: string) =>
    n === 0 ? null : <span className={`h-1.5 rounded-sm ${cls}`} style={{ width: `${(n / total) * 100}%` }} />;
  return (
    <span className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-sm">
      {seg(bad, STATUS.violations.bg)}
      {seg(ok, STATUS.ok.bg)}
      {seg(idle, STATUS.never.bg)}
    </span>
  );
}
