import type { EndpointStats } from "./session";
import { TONE } from "./tone";

export type Status = "violations" | "ok" | "never" | "drift";

/**
 * Status colours are reserved and never stand alone: every use pairs the
 * colour with a glyph and a word, so the screen still reads for someone who
 * cannot tell red from green. Colours are inline — see `tone.ts` for why.
 */
export const STATUS: Record<Status, { color: string; glyph: string; label: string }> = {
  violations: { color: TONE.violation, glyph: "✕", label: "violations" },
  ok: { color: TONE.ok, glyph: "✓", label: "conforms" },
  drift: { color: TONE.drift, glyph: "△", label: "drift" },
  never: { color: TONE.idle, glyph: "·", label: "never called" },
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
      style={{ width: 3, borderRadius: 2, background: STATUS[status].color, alignSelf: "stretch" }}
      title={STATUS[status].label}
      aria-label={STATUS[status].label}
    />
  );
}

/** A count that says what it counts — never a bare coloured number. */
export function Tag({
  status,
  value,
  title,
}: {
  status: Status;
  value: number | string;
  title: string;
}) {
  return (
    <span
      title={title}
      style={{
        color: STATUS[status].color,
        border: `1px solid ${STATUS[status].color}55`,
        background: `${STATUS[status].color}14`,
        borderRadius: 10,
        padding: "0 5px",
        fontSize: 10,
        lineHeight: "15px",
        whiteSpace: "nowrap",
      }}
    >
      {STATUS[status].glyph} {value}
    </span>
  );
}

/** Calls over the session window. One series, so no legend — the row names it. */
export function Sparkline({ moments, buckets = 12 }: { moments: number[]; buckets?: number }) {
  if (moments.length === 0) return null;
  const first = moments[0];
  const span = Math.max(1, moments[moments.length - 1] - first);
  const counts = new Array(buckets).fill(0) as number[];
  for (const ts of moments) {
    counts[Math.min(buckets - 1, Math.floor(((ts - first) / span) * buckets))] += 1;
  }
  const peak = Math.max(...counts, 1);

  return (
    <span
      style={{ display: "inline-flex", alignItems: "flex-end", gap: 1, height: 12 }}
      title={`${moments.length} call${moments.length === 1 ? "" : "s"} over the window`}
    >
      {counts.map((n, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: Math.max(1, Math.round((n / peak) * 12)),
            background: TONE.accent,
            borderRadius: "1px 1px 0 0",
          }}
        />
      ))}
    </span>
  );
}

/** Share of a group by state — one bar, segments 2px apart. */
export function HealthBar({ ok, bad, idle }: { ok: number; bad: number; idle: number }) {
  const total = Math.max(1, ok + bad + idle);
  const seg = (n: number, color: string) =>
    n === 0 ? null : (
      <span style={{ width: `${(n / total) * 100}%`, background: color, borderRadius: 2 }} />
    );
  return (
    <span style={{ display: "flex", flex: 1, height: 6, gap: 2, overflow: "hidden" }}>
      {seg(bad, TONE.violation)}
      {seg(ok, TONE.ok)}
      {seg(idle, "#3a4150")}
    </span>
  );
}
