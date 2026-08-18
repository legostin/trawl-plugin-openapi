import { annotate, type AnnotatedLine } from "./annotate";
import type { Violation } from "./model";
import { TONE, wash } from "./tone";

const MARK = {
  violation: { color: TONE.violation, glyph: "✕" },
  undocumented: { color: TONE.drift, glyph: "＋" },
} as const;

function Line({ line }: { line: AnnotatedLine }) {
  if (line.collapsed) {
    return (
      <div className="py-0.5 pl-3 text-muted-foreground" style={{ fontSize: 10 }}>
        ⋯ {line.collapsed} line{line.collapsed === 1 ? "" : "s"} hidden
      </div>
    );
  }
  const mark = line.mark ? MARK[line.mark] : null;
  return (
    <div
      style={{
        whiteSpace: "pre",
        paddingLeft: 8,
        borderLeft: "2px solid transparent",
        ...(mark ? wash(mark.color) : {}),
      }}
    >
      <span>{line.text}</span>
      {mark && line.note && (
        <span style={{ marginLeft: 12, color: mark.color }}>
          {mark.glyph} {line.note}
        </span>
      )}
    </div>
  );
}

/**
 * The last real response with its problems marked where they happened.
 *
 * The violation list says `/data/items/3/price`; this says it on the line that
 * carries that value, which is the difference between reading and hunting.
 */
export function AnnotatedBody({
  body,
  violations,
  driftPaths,
}: {
  body: string;
  violations: Violation[];
  driftPaths: string[];
}) {
  const result = annotate(body, violations, driftPaths);

  if (result.skipped) {
    return <p className="text-xs text-muted-foreground">{result.skipped}</p>;
  }

  return (
    <div>
      <div
        className="overflow-auto rounded border border-border font-mono"
        style={{ maxHeight: 384, fontSize: 11, lineHeight: "20px" }}
      >
        {result.lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
      </div>
      {result.unmatched.length > 0 && (
        <p className="mt-1" style={{ fontSize: 10, color: TONE.drift, opacity: 0.85 }}>
          {result.unmatched.length} violation
          {result.unmatched.length === 1 ? "" : "s"} point at fields this body no longer has —
          the response changed since it was measured.
        </p>
      )}
    </div>
  );
}
