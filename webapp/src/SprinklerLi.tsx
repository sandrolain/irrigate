import { BFF_ADDRESS } from "./config";
import { Sprinkler } from "./model";
import { useForceUpdate } from "./utils";

export function SprinklerLi(props: {state: Sprinkler, config: Sprinkler}) {
  const forceUpdate = useForceUpdate();
  const {state, config} = props;
  return (<div className="Sprinkler" data-sts-open={state.open} data-cfg-open={config.open}>
    <div className="Sprinkler-toggle" onClick={() => {
      config.open = !config.open;
      configSprinkler({...config});
      forceUpdate();
    }}></div>
    <div className="Sprinkler-cnt">
      <div className="Sprinkler-id"><b>{state.id}</b></div>
      <div className="Sprinkler-Pressure"><span>Pressure: {state.pressure.toFixed(1)} / {config.pressure.toFixed(1)}</span>
        <button onClick={(e) => {
          config.pressure -= 0.1;
          configSprinkler({...config});
          forceUpdate();
        }}>-</button>
        <button onClick={(e) => {
          config.pressure += 0.1;
          configSprinkler({...config});
          forceUpdate();
        }}>+</button>
      </div>
      <div className="Sprinkler-Direction"><span>Direction: {state.direction} / {config.direction}</span>
        <button onClick={(e) => {
          config.direction -= 10;
          configSprinkler({...config});
          forceUpdate();
        }}>-</button>
        <button onClick={(e) => {
          config.direction += 10;
          configSprinkler({...config});
          forceUpdate();
        }}>+</button>
      </div>
    </div>
  </div>)
}

export async function configSprinkler(config: Sprinkler) {
  const response = await fetch(`http://${BFF_ADDRESS}/sprinkler/config`, {
    method: "POST",
    headers: new Headers({"Content-Type": "application/json"}),
    body: JSON.stringify(config)
  });
  if (response.status > 399) {
    const body = await response.json();
    alert(body.message);
  }
}
