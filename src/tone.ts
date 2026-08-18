/**
 * The plugin's own colours, as inline styles.
 *
 * A plugin cannot use arbitrary Tailwind classes: the host generates CSS from
 * *its* sources, so a class the host never writes — `text-red-400`,
 * `grid-cols-5`, `tabular-nums` — simply does not exist at runtime and the
 * element renders unstyled. Semantic host tokens (`bg-card`,
 * `text-muted-foreground`, `border-border`) are safe because the host uses
 * them; everything else is written as a style object here.
 */
export const TONE = {
  violation: "#f2777a",
  ok: "#5ec98a",
  drift: "#e2b04a",
  idle: "#6b7280",
  accent: "#5b8dd6",
} as const;

export const text = (color: string) => ({ color });
export const fill = (color: string) => ({ background: color });

/** A soft wash behind a marked line, in the same hue as its mark. */
export const wash = (color: string) => ({
  background: `${color}1f`,
  borderLeft: `2px solid ${color}`,
});
