import { annotate, type AnnotatedLine } from "./annotate";
import type { Schema, Violation } from "./model";
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
      {/* What the spec promised, held to the right so the body still reads as
          a body rather than a table. */}
      {line.expected && !mark && (
        <span className="text-muted-foreground" style={{ marginLeft: 12, opacity: 0.55 }}>
          {line.expected}
        </span>
      )}
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
  schema,
}: {
  body: string;
  violations: Violation[];
  driftPaths: string[];
  schema?: Schema;
}) {
  const result = annotate(body, violations, driftPaths, schema);

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
      {result.missing.length > 0 && (
        <p className="mt-1" style={{ fontSize: 10, color: TONE.idle }}>
          documented but not in this response: {result.missing.slice(0, 12).join(", ")}
          {result.missing.length > 12 && ` and ${result.missing.length - 12} more`}
        </p>
      )}
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
