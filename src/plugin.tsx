import { startEngine } from "./engine";
import { FlowPanel } from "./FlowPanel";
import { sampleFromFlow } from "./flow";
import { matchFlow } from "./match";
import { registerMcpTools } from "./mcp";
import { endpointKey } from "./model";
import { OpenApiApp } from "./OpenApiApp";
import { screenLine } from "./screen";
import { requestSelection } from "./selection";

const host = window.__TRAWL__;

if (host) {
  const engine = startEngine(host);
  void engine.start();

  host.registerMode({ id: "openapi", label: "OpenAPI", component: OpenApiApp });

  // Init-time only: that is how the host attributes the tools to this plugin.
  registerMcpTools(host, engine);

  // 1.15.0 and newer: tell the agent which endpoint is open, so it stops
  // having to ask what the user is looking at.
  host.registerScreenContext?.(screenLine);

  // 1.12.0 and newer: the verdict lives in the request card itself. On older
  // hosts the "Open in spec" action below stays the only bridge.
  if (host.registerFlowPanel) {
    host.registerFlowPanel({ id: "openapi", label: "OpenAPI", component: FlowPanel });
  }

  // The bridge for hosts older than 1.12.0, and a shortcut everywhere else.
  //
  host.registerFlowAction({
    id: "openapi-open-in-spec",
    label: "Open in spec",
    run: (flow) => {
      const sample = sampleFromFlow(flow, host.util.bodyText);
      const match = matchFlow(engine.store.list(), sample);
      if (!match) {
        host.log("openapi: no endpoint documents", sample.method, sample.host + sample.path);
      } else {
        requestSelection({ specId: match.spec.id, endpointKey: endpointKey(match.endpoint) });
      }
      host.setMode("openapi");
    },
  });
}
