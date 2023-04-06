import express, { Express, Request, Response } from 'express';
import { connectMqtt, sendSprinklerConfig } from './mqtt';
import expressWs from "express-ws";
import ws from "ws";
import { SprinklerConfig, sprinklerTemplate } from './model';
import { initRedisConnection as connectRedis, setRainyWeather as setWeather } from './redis';
import cors from "cors";

const BROKER_URI      = process.env.BROKER_URI as string ?? "ws://127.0.0.1:1883";
const PORT            = process.env.PORT as string ?? "8080";
const REDIS_URI       = process.env.REDIS_URI as string ?? "redis://127.0.0.1:6379";
const REDIS_PASSWORD  = process.env.REDIS_URI as string ?? "mypassword";

const { app, getWss, applyTo } = expressWs(express());
app.use(express.json());
app.use(cors());

function isValidSprinklerConfig(config: SprinklerConfig): boolean {
  for(const key in sprinklerTemplate) {
    const k = key as keyof SprinklerConfig
    if (typeof config[k] != typeof sprinklerTemplate[k]) {
      return false;
    }
  }
  return true;
}

interface ErrorResponse {
  code: number;
  message?: string
}

function errorResponse(res: Response, code: number, message?: string) {
  message = message ?? `Error ${code}`;
  res.status(code);
  res.json({code, message})
}

app.post('/weather/:weather', (req: Request, res: Response) => {
  const {weather} = req.params;
  console.log("Set weather:", weather)
  if(!setWeather(weather)) {
    return errorResponse(res, 500, "The wather status could not be sent");
  }
  res.status(201);
});

app.post('/sprinkler/config', (req: Request, res: Response) => {
  const data = req.body;
  if (!isValidSprinklerConfig(data)) {
    return errorResponse(res, 400, "The configuration is invalid");
  }
  if(!sendSprinklerConfig(data)) {
    return errorResponse(res, 500, "The new configuration could not be sent");
  }
  res.status(201);
});

const wsClients: Set<ws> = new Set();

app.ws('/', function(ws) {
  wsClients.add(ws);
  ws.on('message', function(msg) {
    console.log("Message from client:", msg)
  });
  ws.on('close', () => {
    wsClients.delete(ws);
  });
});



connectMqtt(BROKER_URI, (topic, msg) => {
  const data = JSON.parse(msg.toString("utf-8"));
  wsClients.forEach((ws) => {
    ws.send(JSON.stringify({ topic, data }));
  });
});

connectRedis(REDIS_URI, REDIS_PASSWORD);

app.listen(PORT, () => {
  console.log(`BFF is running on port ${PORT}`);
});
