import * as mqtt from "mqtt";
import { SprinklerConfig } from "./model";

let client: mqtt.Client | null;

export function connectMqtt(brokerUri: string, cb: mqtt.OnMessageCallback) {
  client = mqtt.connect(brokerUri);

  client.on('connect', function () {
    console.log("Connected to MQTT Broker")
  });

  client.on('message', cb);

  client.on('disconnect', function (e) {
    reconnect(brokerUri, cb);
  });
  client.on('error', function (e) {
    console.error("Cannot connect to MQTT:", e)
    reconnect(brokerUri, cb);
  });
  client.on('offline', function () {
    reconnect(brokerUri, cb);
  });

  client.subscribe("garden/status");
}

function reconnect(brokerUri: string, cb: mqtt.OnMessageCallback) {
  client?.end();
  client = null;
  setTimeout(() => connectMqtt(brokerUri, cb), 1000);
}

export function sendSprinklerConfig(config: SprinklerConfig): boolean {
  if (client) {
    console.log("Send Sprinkler config:", config)
    client.publish(`garden/config`, JSON.stringify(config));
    return true;
  }
  console.log("Cannot send Sprinkler config:", config)
  return false;
}
