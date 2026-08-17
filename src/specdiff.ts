import { schemaPaths } from "./drift";
import { endpointKey, type Endpoint, type SpecChange, type SpecDoc } from "./model";

/** The response a client actually depends on: the first documented 2xx. */
function successSchema(endpoint: Endpoint) {
  const key = Object.keys(endpoint.responses).find((k) => k.startsWith("2"));
  return key ? endpoint.responses[key].schema : undefined;
}

function diffEndpoint(before: Endpoint, after: Endpoint): SpecChange[] {
  const key = endpointKey(after);
  const out: SpecChange[] = [];

  for (const status of Object.keys(before.responses)) {
    if (!(status in after.responses)) {
      out.push({ key, detail: `response ${status} removed`, breaking: true });
    }
  }

  const wasPaths = schemaPaths(successSchema(before));
  const nowPaths = schemaPaths(successSchema(after));
  for (const path of wasPaths) {
    if (!nowPaths.has(path)) {
      out.push({ key, detail: `response field removed: ${path}`, breaking: true });
    }
  }
  for (const path of nowPaths) {
    if (!wasPaths.has(path)) {
      out.push({ key, detail: `response field added: ${path}`, breaking: false });
    }
  }

  const wasRequired = new Set(
    before.params.filter((p) => p.required).map((p) => `${p.in}:${p.name}`),
  );
  for (const p of after.params) {
    if (p.required && !wasRequired.has(`${p.in}:${p.name}`)) {
      out.push({ key, detail: `${p.in} parameter now required: ${p.name}`, breaking: true });
    }
  }

  return out;
}

/** What changed between two versions of the same spec, breaking first. */
export function diffSpecs(before: SpecDoc, after: SpecDoc): SpecChange[] {
  const was = new Map(before.endpoints.map((e) => [endpointKey(e), e]));
  const now = new Map(after.endpoints.map((e) => [endpointKey(e), e]));
  const out: SpecChange[] = [];

  for (const [key, endpoint] of now) {
    const previous = was.get(key);
    if (!previous) out.push({ key, detail: "endpoint added", breaking: false });
    else out.push(...diffEndpoint(previous, endpoint));
  }
  for (const key of was.keys()) {
    if (!now.has(key)) out.push({ key, detail: "endpoint removed", breaking: true });
  }

  return out.sort((a, b) => Number(b.breaking) - Number(a.breaking) || a.key.localeCompare(b.key));
}
