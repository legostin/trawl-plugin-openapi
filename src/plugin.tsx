import { startEngine } from "./engine";
import { sampleFromFlow } from "./flow";
import { matchFlow } from "./match";
import { endpointKey } from "./model";
import { OpenApiApp } from "./OpenApiApp";
import { requestSelection } from "./selection";

const host = window.__TRAWL__;

if (host) {
  const engine = startEngine(host);
  void engine.start();

  host.registerMode({ id: "openapi", label: "OpenAPI", component: OpenApiApp });

  // Until the host grows a flow panel (stage 7), this button is the bridge
  // from a captured request to the endpoint that documents it.
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
