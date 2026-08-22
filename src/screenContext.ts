import type { Engine } from "./engine";
import { endpointKey, type Endpoint, type Spec } from "./model";

/** What the mode currently shows, for the agent's screen block.
 *
 *  Kept to pointers and counts: the agent has MCP tools for everything else,
 *  and this line is competing for room with the user's actual question. */
export function describeScreen(
  engine: Engine,
  spec: Spec | null,
  endpoint: Endpoint | null,
  tab: string,
): string | null {
  if (!spec) return "no spec loaded";

  const parts = [`spec "${spec.title}" ${spec.version}`.trim()];
  parts.push(spec.hosts.length > 0 ? `bound to ${spec.hosts.join(", ")}` : "not bound to any host");
  parts.push(`window: ${engine.window}`);
  parts.push(`tab: ${tab}`);

  if (endpoint) {
    const key = endpointKey(endpoint);
    const stats = engine.aggregates.forEndpoint(spec.id, key);
    const drift = engine.drift.report(key);
    const bits = [`open endpoint: ${key}`, `${stats.calls} calls`];
    if (stats.violations > 0) bits.push(`${stats.violations} with violations`);
    if (drift && drift.undocumented.length > 0) {
      bits.push(`${drift.undocumented.length} undocumented fields`);
    }
    parts.push(bits.join(" · "));
  } else {
    parts.push("no endpoint selected");
  }

  const totals = engine.aggregates.totals();
  parts.push(`${totals.calls} calls in window, ${totals.violations} with violations`);
  return parts.join("; ");
}
