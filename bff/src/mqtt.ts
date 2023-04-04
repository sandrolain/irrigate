import * as mqtt from "mqtt";

let client: mqtt.Client;

export function connectMqtt(brokerUri) {
  client = mqtt.connect(brokerUri);

  client.on('connect', function () {

  });

  client.on('message', function (topic, message) {

  });

  client.on('disconnect', function () {
    reconnect(brokerUri);
  });
  client.on('error', function () {
    reconnect(brokerUri);
  });
  client.on('offline', function () {
    reconnect(brokerUri);
  });

}

function reconnect(brokerUri: string) {
  client?.end();
  client = null;
  setTimeout(() => connectMqtt(brokerUri), 1000);
}

export interface ConfigMessage {
	pressure?: number;
	x?: number;
	y?: number;
	direction?: number;
}

export function sendSprinklerConfig(uuid: number, config: ConfigMessage): boolean {
  if (client) {
    client.publish(`garden/config/${uuid}`, JSON.stringify(config));
    return true;
  }
  return false;
}
