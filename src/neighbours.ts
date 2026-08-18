import type { OpenPayload } from "./tryit";

const host = window.__TRAWL__!;

/** A plugin is present if it declared the event we need. `known()` is the only
 *  way to ask; a missing neighbour must disable a button, never throw. */
function declares(type: string): boolean {
  try {
    return host.events.known().some((e) => e.type === type);
  } catch {
    return false;
  }
}

export const hasHttpClient = () => declares("http-client:open");
export const hasCollectionImport = () => declares("http-client:import-collection");
export const hasSchemaCheck = () => declares("schemacheck:create-contract");

export function openInClient(payload: OpenPayload): void {
  host.events.emit("http-client:open", payload);
  host.setMode("http-client");
}

export interface CollectionRequest extends OpenPayload {
  name: string;
}

export function importCollection(name: string, requests: CollectionRequest[]): void {
  host.events.emit("http-client:import-collection", { name, requests });
  host.setMode("http-client");
}

export interface ContractDraft {
  name: string;
  method: string;
  pattern: string;
  body: string;
  status?: number;
}

export function createContract(draft: ContractDraft): void {
  host.events.emit("schemacheck:create-contract", draft);
}

export interface ContractSummary {
  id: string;
  name: string;
  method: string;
  pattern: string;
  lastStatus: string;
}

let contracts: ContractSummary[] = [];

/** The other half of the integration: the spec shows which endpoints already
 *  have a contract and how it last fared. Schema Check publishes the list on
 *  `schemacheck:updated` (0.3.0 and newer); older versions send nothing, and
 *  then no badge appears — which is correct, not broken. */
export function watchContracts(onChange: () => void): () => void {
  const seed = host.events.known().find((e) => e.type === "schemacheck:updated");
  if (Array.isArray(seed?.lastPayload)) contracts = seed.lastPayload as ContractSummary[];
  return host.events.on("schemacheck:updated", (payload) => {
    contracts = Array.isArray(payload) ? (payload as ContractSummary[]) : [];
    onChange();
  });
}

/** The contract covering `method` + `hostPath`, if Schema Check has one. */
export function contractFor(method: string, hostPath: string): ContractSummary | undefined {
  return contracts.find((c) => {
    if (c.method !== "*" && c.method.toUpperCase() !== method.toUpperCase()) return false;
    const re = new RegExp(
      `^${c.pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
    );
    return re.test(hostPath);
  });
}
