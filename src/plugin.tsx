const host = window.__TRAWL__;

function OpenApiApp() {
  return <div className="p-4 text-muted-foreground">OpenAPI</div>;
}

if (host) {
  host.registerMode({ id: "openapi", label: "OpenAPI", component: OpenApiApp });
}
