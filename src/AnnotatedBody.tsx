import { annotate, type AnnotatedLine } from "./annotate";
import type { Violation } from "./model";

const MARK = {
  violation: { row: "bg-red-500/10 border-l-2 border-red-400", note: "text-red-400", glyph: "✕" },
  undocumented: {
    row: "bg-amber-500/10 border-l-2 border-amber-400",
    note: "text-amber-400",
    glyph: "＋",
  },
} as const;

function Line({ line }: { line: AnnotatedLine }) {
  if (line.collapsed) {
    return (
      <div className="py-0.5 pl-3 text-[10px] text-muted-foreground">
        ⋯ {line.collapsed} line{line.collapsed === 1 ? "" : "s"} hidden
      </div>
    );
  }
  const mark = line.mark ? MARK[line.mark] : null;
  return (
    <div className={`whitespace-pre pl-2 ${mark ? mark.row : "border-l-2 border-transparent"}`}>
      <span>{line.text}</span>
      {mark && line.note && (
        <span className={`ml-3 ${mark.note}`}>
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
      <div className="max-h-96 overflow-auto rounded border border-border font-mono text-[11px] leading-5">
        {result.lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
      </div>
      {result.unmatched.length > 0 && (
        <p className="mt-1 text-[10px] text-amber-400/80">
          {result.unmatched.length} violation
          {result.unmatched.length === 1 ? "" : "s"} point at fields this body no longer has —
          the response changed since it was measured.
        </p>
      )}
    </div>
  );
}
