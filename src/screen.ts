import { getEngine } from "./engine";
import { describeScreen } from "./screenContext";
import type { Endpoint, Spec } from "./model";

interface Snapshot {
  spec: Spec | null;
  endpoint: Endpoint | null;
  tab: string;
}

let current: Snapshot = { spec: null, endpoint: null, tab: "browse" };

/** Called by the mode as it renders. Cheap on purpose: the agent asks for this
 *  at send time, and the answer must not require walking any traffic. */
export function setScreen(next: Snapshot): void {
  current = next;
}

/** What the agent is told about this plugin's screen, or nothing to say. */
export function screenLine(): string | null {
  const engine = getEngine();
  if (!engine) return null;
  return describeScreen(engine, current.spec, current.endpoint, current.tab);
}
