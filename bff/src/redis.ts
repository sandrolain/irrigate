import { RedisClientType, createClient } from 'redis';

let client: RedisClientType;

export async function initRedisConnection(url: string, password: string) {
  client = createClient({url, password});
  client.on('error', err => console.log('Redis Client Error', err));
  client.on('ready', () => console.log('Redis Client Ready'));
  await client.connect();
}

export function setRainyWeather(weather: string): boolean {
  if (client) {
    client.set("weather", weather);
    return true;
  }
  return false;
}
