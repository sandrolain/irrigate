import express, { Express, Request, Response } from 'express';
import { connectMqtt } from './mqtt';

const BROKER_URI = process.env.BROKER_URI as string;
const port       = process.env.PORT as string;

const app: Express = express();
app.use(express.json());

interface SprinklerConfig {
  pressure?: number;
  x?: number;
  y?: number;
  direction?: number;
};

function isValidSprinklerConfig(config: SprinklerConfig): boolean {
  const keys = Object.keys(config);
  return keys.includes("pressure") || keys.includes("x") || keys.includes("y") || keys.includes("direction");
}

interface ErrorResponse {
  code: number;
  message: string
}

function errorResponse(res: Response, code: number, message?: string) {
  message = message ?? `Error ${code}`;
  res.status(code);
  res.json({code, message})
}


app.post('/sprinkler/:id/:param', (req: Request, res: Response) => {
  const data = req.body;
  if (!isValidSprinklerConfig(data)) {
    return errorResponse(res, 400)
  }
});


app.listen(port, () => {
  console.log(`BFF is running on port ${port}`);
});

connectMqtt(BROKER_URI);
