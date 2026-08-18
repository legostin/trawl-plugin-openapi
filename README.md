# Trawl OpenAPI plugin

Browse OpenAPI 3.0/3.1 and Swagger 2.0 specs inside Trawl.

Load a spec from a URL (with an optional header for private ones — project
variables like `{{token}}` are substituted), from a local file, or by pasting
it. Specs are stored per project. Endpoints are grouped by tag and searchable;
the detail view shows parameters, request body and every documented response
with its schema outlined field by field.

Unresolvable pieces are marked rather than hidden: an external `$ref` shows as
`— external $ref (…) — not followed`, and a self-referencing schema stops with
`↺ circular`. A spec whose `servers` are relative (`/api/v3`) binds to no host
until you say which one it belongs to.

## Install

Trawl → **Plugins** → install `legostin/trawl-plugin-openapi`.

## A note for plugin authors

A plugin cannot use arbitrary Tailwind classes. The host generates its CSS from
*its own* sources, so a class the host never writes — `text-red-400`,
`grid-cols-5`, `text-[11px]` — does not exist at runtime and the element simply
renders unstyled. Semantic host tokens (`bg-card`, `text-muted-foreground`,
`border-border`, `bg-accent`) are safe because the host uses them; everything
else lives in `src/tone.ts` as inline styles.

## Develop

```sh
pnpm install
pnpm test
pnpm build     # emits dist/plugin.js, which is committed
```

## Spec against traffic

Captured requests are matched to the endpoint that documents them and checked
against its schema. Each endpoint shows how many times it was called in the
chosen session window — since capture started, the whole project, or whatever
the traffic filter currently selects — along with the violations found and the
calls nothing documents at all.

Bind the spec to a host first: specs whose `servers` are relative (`/api/v3`)
have nothing to match on until you say which host they belong to.

Two limits, stated rather than hidden. History carries no bodies (Trawl stores
none), so replayed flows are counted and status-checked but never
body-validated — the panel says so. And anything the plugin does not fully
understand, from an external `$ref` to a non-JSON payload, is skipped with a
note instead of being reported as a violation.

From the traffic list, **Open in spec** jumps to the endpoint a request
matched.

## Coverage and drift

The **coverage** tab ranks every endpoint by what needs attention — violations
first, then never-called, then healthy — and shows what share of the API the
session actually exercised. **Undocumented** lists calls on a bound host that
match no endpoint. **Drift** compares the fields the wire carries against the
fields the schema describes, and shows what the last spec refresh changed, with
breaking changes marked.

Drift is measured from live responses only: history keeps no bodies.

## Acting on the spec

**Try it** sends an endpoint to the HTTP Client with path values taken from a
real previous call when there was one, required query parameters filled from
the schema, and `Bearer {{token}}` for secured endpoints. **Mock** creates a
Trawl handler rule that answers from the spec's own example without touching
the network; press it again to remove the rule. **Import as collection** sends
every endpoint to the HTTP Client at once, and **Create contract** hands the
response example to Schema Check — which in turn reports back, so an endpoint
already covered by a contract shows its last status.

Generated values are deliberately obvious (`"string"`, `0`) unless the spec
supplies an `example`: a realistic-looking fake gets mistaken for real data.

Buttons whose plugin is missing are disabled with the reason. Collection import
needs HTTP Client 0.8.0, contracts need Schema Check 0.3.0.

## For agents

With Trawl's MCP server running, an agent gets seven read-only tools:
`openapi_list_specs`, `openapi_find_endpoint`, `openapi_endpoint_schema`,
`openapi_coverage`, `openapi_violations`, `openapi_undocumented` and
`openapi_drift`. Together they answer "what does this API promise?" and "where
has the traffic disagreed with it?" — the two questions the traffic log alone
cannot.

Nothing here mutates: mocks and contracts stay a human action.

## Reading it at a glance

Every endpoint in the tree carries a status strip, a call count and a sparkline
of when those calls happened. The endpoint card leads with the verdict and then
shows **the last real response with its problems marked on the lines they
happened** — a red line for a value that broke the schema, an amber one for a
field the spec never mentions. A pointer like `/data/items/3/price` tells you
where to look; this shows you.

Above the tabs sit five numbers — coverage, calls, violations, undocumented
calls, drift fields — and the coverage tab adds a square per endpoint plus
per-tag health bars, so the shape of the whole API is one glance rather than a
scroll.

Status colours never travel alone: each carries a glyph and a word.

## In the request card

On Trawl 1.12.0 and newer the plugin adds an **OpenAPI** tab to the request
details: which endpoint the request matched, whether it conformed, and what
broke if it did not — with a link into the spec. On older hosts the "Open in
spec" action does the same job in one click less detail.
