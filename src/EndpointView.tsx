import type { Engine } from "./engine";
import { exampleFor } from "./example";
import { buildMock } from "./mock";
import { endpointKey, type Endpoint, type Schema, type Spec } from "./model";
import {
  contractFor,
  createContract,
  hasHttpClient,
  hasSchemaCheck,
  openInClient,
} from "./neighbours";
import { buildRequest } from "./tryit";

const host = window.__TRAWL__!;
const { MethodBadge } = host.ui;

/** One line per field, so a response shape is readable without unfolding JSON. */
function SchemaTree({ schema, name, depth = 0 }: { schema?: Schema; name?: string; depth?: number }) {
  if (!schema) return null;
  const type = Array.isArray(schema.type) ? schema.type.join(" | ") : (schema.type ?? "any");
  const suffix = schema.format ? ` <${schema.format}>` : "";
  const note = schema.circular ? " ↺ circular" : schema.incomplete ? ` — ${schema.incomplete}` : "";

  return (
    <div style={{ paddingLeft: depth * 12 }} className="font-mono text-xs leading-5">
      <span className="text-foreground">{name ? `${name}: ` : ""}</span>
      <span className="text-muted-foreground">
        {type}
        {suffix}
        {schema.enum ? ` [${schema.enum.map(String).join(", ")}]` : ""}
        {note && <span className="text-amber-400">{note}</span>}
      </span>
      {schema.properties &&
        Object.entries(schema.properties).map(([child, s]) => (
          <SchemaTree key={child} schema={s} name={child} depth={depth + 1} />
        ))}
      {schema.items && <SchemaTree schema={schema.items} name="[]" depth={depth + 1} />}
      {schema.oneOf?.map((s, i) => (
        <SchemaTree key={`oneOf${i}`} schema={s} name={`oneOf #${i + 1}`} depth={depth + 1} />
      ))}
      {schema.anyOf?.map((s, i) => (
        <SchemaTree key={`anyOf${i}`} schema={s} name={`anyOf #${i + 1}`} depth={depth + 1} />
      ))}
    </div>
  );
}

function Actions({ engine, spec, endpoint }: { engine: Engine; spec: Spec; endpoint: Endpoint }) {
  const key = endpointKey(endpoint);
  const mockId = spec.mocks?.[key];
  const statuses = Object.keys(endpoint.responses).filter((s) => /^\d+$/.test(s));
  const mockStatus = Number(statuses.find((s) => s.startsWith("2")) ?? statuses[0] ?? 200);

  const tryIt = () => openInClient(buildRequest(spec, endpoint, engine.lastCall(spec.id, key)));

  const toggleMock = async () => {
    if (mockId) {
      await host.rules.remove(mockId);
      await engine.store.clearMock(spec.id, key);
      return;
    }
    const id = await host.rules.create(buildMock(spec, endpoint, mockStatus), { open: false });
    await engine.store.setMock(spec.id, key, id);
  };

  const asContract = () => {
    const response = endpoint.responses[String(mockStatus)];
    createContract({
      name: `${endpoint.method} ${endpoint.pathTemplate}`,
      method: endpoint.method,
      pattern: `${spec.hosts[0] ?? "*"}${endpoint.pathTemplate.replace(/\{[^}]+\}/g, "*")}`,
      body: JSON.stringify(exampleFor(response?.schema) ?? {}, null, 2),
      status: mockStatus,
    });
  };

  const contract = spec.hosts[0]
    ? contractFor(
        endpoint.method,
        `${spec.hosts[0]}${endpoint.pathTemplate.replace(/\{[^}]+\}/g, "*")}`,
      )
    : undefined;

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        className="underline disabled:no-underline disabled:opacity-40"
        disabled={!hasHttpClient()}
        title={hasHttpClient() ? "" : "The HTTP Client plugin is not installed"}
        onClick={tryIt}
      >
        Try it
      </button>
      <button className="underline" onClick={() => void toggleMock()}>
        {mockId ? `Mock active (${mockStatus}) — remove` : `Mock ${mockStatus}`}
      </button>
      <button
        className="underline disabled:no-underline disabled:opacity-40"
        disabled={!hasSchemaCheck()}
        title={hasSchemaCheck() ? "" : "Schema Check 0.3.0 or newer is not installed"}
        onClick={asContract}
      >
        Create contract
      </button>
      {contract && (
        <span
          className={contract.lastStatus === "fail" ? "text-red-400" : "text-muted-foreground"}
          title={contract.name}
        >
          contract: {contract.lastStatus}
        </span>
      )}
    </div>
  );
}

export function EndpointView({
  engine,
  spec,
  endpoint,
}: {
  engine: Engine;
  spec: Spec | null;
  endpoint: Endpoint | null;
}) {
  if (!endpoint) {
    return <p className="p-4 text-sm text-muted-foreground">Pick an endpoint on the left.</p>;
  }

  const params = ["path", "query", "header", "cookie"] as const;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MethodBadge method={endpoint.method} />
        <span className="font-mono text-sm">{endpoint.pathTemplate}</span>
        {endpoint.operationId && (
          <span className="text-xs text-muted-foreground">· {endpoint.operationId}</span>
        )}
      </div>
      {spec && <Actions engine={engine} spec={spec} endpoint={endpoint} />}
      {endpoint.summary && <p className="text-sm text-muted-foreground">{endpoint.summary}</p>}
      {endpoint.security.length > 0 && (
        <p className="text-xs text-muted-foreground">security: {endpoint.security.join(", ")}</p>
      )}

      {params.map((where) => {
        const list = endpoint.params.filter((p) => p.in === where);
        if (list.length === 0) return null;
        return (
          <section key={where}>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{where}</h3>
            {list.map((p) => (
              <div key={p.name} className="font-mono text-xs leading-5">
                {p.name}
                {p.required && <span className="text-amber-400">*</span>}
                <span className="text-muted-foreground">
                  {" "}
                  {Array.isArray(p.schema?.type)
                    ? p.schema?.type.join(" | ")
                    : (p.schema?.type ?? "any")}
                  {p.schema?.enum ? ` [${p.schema.enum.map(String).join(", ")}]` : ""}
                </span>
              </div>
            ))}
          </section>
        );
      })}

      {endpoint.requestBody && (
        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            request body · {endpoint.requestBody.contentTypes.join(", ") || "—"}
          </h3>
          <SchemaTree schema={endpoint.requestBody.schema} />
        </section>
      )}

      <section>
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">responses</h3>
        {Object.entries(endpoint.responses).map(([status, body]) => (
          <div key={status} className="mb-2">
            <div className="text-xs">
              {status}
              <span className="text-muted-foreground">
                {" "}
                · {body.contentTypes.join(", ") || "no body"}
              </span>
            </div>
            <SchemaTree schema={body.schema} />
          </div>
        ))}
      </section>
    </div>
  );
}
