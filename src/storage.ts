import type { Spec } from "./model";

const FORMAT = 1;

export function encodeSpecs(specs: Spec[]): string {
  return JSON.stringify({ v: FORMAT, specs });
}

/** Decoding never throws and never invents data: a damaged or newer payload
 *  comes back as an empty list plus a reason the UI can show. */
export function decodeSpecs(raw: string | null): { specs: Spec[]; error?: string } {
  if (!raw) return { specs: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { specs: [], error: "Stored specs are damaged and were not loaded." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { specs: [], error: "Stored specs are damaged and were not loaded." };
  }
  const { v, specs } = parsed as { v?: unknown; specs?: unknown };
  if (v !== FORMAT) {
    return {
      specs: [],
      error: `Stored specs use format ${String(v)}; this plugin reads ${FORMAT}.`,
    };
  }
  if (!Array.isArray(specs)) {
    return { specs: [], error: "Stored specs are damaged and were not loaded." };
  }
  return { specs: specs as Spec[] };
}
