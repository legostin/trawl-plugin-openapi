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

## Develop

```sh
pnpm install
pnpm test
pnpm build     # emits dist/plugin.js, which is committed
```

## Roadmap

Stage 1 (this release) is the reader. Next: matching captured traffic against
the spec, validation, coverage and drift, then Try-it into the HTTP Client,
mocks, contracts, and MCP tools.
