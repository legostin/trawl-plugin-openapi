import type { Violation } from "./model";

/** Same ceiling as validation: past this the body is not worth pretty-printing. */
export const MAX_BODY_BYTES = 512 * 1024;
/** A 5000-line response must not be printed in full to show two problems. */
export const MAX_ANNOTATED = 200;
const CONTEXT = 3;

export type Mark = "violation" | "undocumented";

export interface AnnotatedLine {
  text: string;
  /** JSON pointer of the value on this line. */
  pointer: string;
  mark?: Mark;
  note?: string;
  /** A stand-in for lines hidden between marked regions. */
  collapsed?: number;
}

export interface Annotated {
  lines: AnnotatedLine[];
  /** Pointers the verdict mentioned that this body no longer has. */
  unmatched: string[];
  /** Why nothing was printed, when nothing was. */
  skipped?: string;
}

/** Pretty-print, emitting the JSON pointer of every line as it goes. Printing
 *  and then re-parsing the output back into pointers is where this goes wrong;
 *  the printer already knows the path, so it says so. */
function print(
  value: unknown,
  pointer: string,
  indent: number,
  prefix: string,
  comma: boolean,
  out: AnnotatedLine[],
): void {
  const pad = "  ".repeat(indent);
  const tail = comma ? "," : "";

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ text: `${pad}${prefix}[]${tail}`, pointer });
      return;
    }
    out.push({ text: `${pad}${prefix}[`, pointer });
    value.forEach((item, i) =>
      print(item, `${pointer}/${i}`, indent + 1, "", i < value.length - 1, out),
    );
    out.push({ text: `${pad}]${tail}`, pointer });
    return;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out.push({ text: `${pad}${prefix}{}${tail}`, pointer });
      return;
    }
    out.push({ text: `${pad}${prefix}{`, pointer });
    entries.forEach(([key, child], i) =>
      print(
        child,
        `${pointer}/${key}`,
        indent + 1,
        `${JSON.stringify(key)}: `,
        i < entries.length - 1,
        out,
      ),
    );
    out.push({ text: `${pad}}${tail}`, pointer });
    return;
  }

  out.push({ text: `${pad}${prefix}${JSON.stringify(value) ?? "null"}${tail}`, pointer });
}

/** Array indices collapse the way drift reports them: /tags/1/name → /tags[]/name. */
const asDriftPath = (pointer: string) => pointer.replace(/\/\d+(?=\/|$)/g, "[]");

/** Keep the marked lines and their surroundings; say how much was hidden. */
function collapse(lines: AnnotatedLine[]): AnnotatedLine[] {
  if (lines.length <= MAX_ANNOTATED) return lines;
  const keep = new Set<number>();
  lines.forEach((line, i) => {
    if (!line.mark) return;
    for (let j = i - CONTEXT; j <= i + CONTEXT; j += 1) if (j >= 0 && j < lines.length) keep.add(j);
  });
  // Without a single mark, show the head rather than nothing.
  if (keep.size === 0) for (let i = 0; i < MAX_ANNOTATED; i += 1) keep.add(i);
  keep.add(0);
  keep.add(lines.length - 1);

  const out: AnnotatedLine[] = [];
  let hidden = 0;
  lines.forEach((line, i) => {
    if (keep.has(i)) {
      if (hidden > 0) {
        out.push({ text: "", pointer: "", collapsed: hidden });
        hidden = 0;
      }
      out.push(line);
    } else {
      hidden += 1;
    }
  });
  if (hidden > 0) out.push({ text: "", pointer: "", collapsed: hidden });
  return out;
}

/**
 * The response body with its problems marked where they happened.
 *
 * A violation is a pointer and a sentence; on screen that still leaves the
 * reader hunting through JSON. This puts the sentence on the line it is about.
 */
export function annotate(
  bodyText: string,
  violations: Violation[],
  driftPaths: string[],
): Annotated {
  if (bodyText.length > MAX_BODY_BYTES) {
    return { lines: [], unmatched: [], skipped: "The body is too large to annotate." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { lines: [], unmatched: [], skipped: "The body is not JSON, so nothing is marked." };
  }

  const lines: AnnotatedLine[] = [];
  print(parsed, "", 0, "", false, lines);

  const unmatched: string[] = [];
  for (const violation of violations) {
    const line = lines.find((l) => l.pointer === violation.pointer);
    if (!line) {
      unmatched.push(violation.pointer);
      continue;
    }
    line.mark = "violation";
    line.note = `expected ${violation.expected}, got ${violation.actual}`;
  }

  const drift = new Set(driftPaths);
  for (const line of lines) {
    if (line.mark || !drift.has(asDriftPath(line.pointer))) continue;
    line.mark = "undocumented";
    line.note = "arrives, not in the spec";
  }

  return { lines: collapse(lines), unmatched };
}
