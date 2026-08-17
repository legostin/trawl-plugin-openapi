import { OpenApiApp } from "./OpenApiApp";

const host = window.__TRAWL__;

if (host) {
  host.registerMode({ id: "openapi", label: "OpenAPI", component: OpenApiApp });
}
