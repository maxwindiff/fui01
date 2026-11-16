import { handle } from "../server/ask.js";

export const config = { maxDuration: 60 };

export function POST(req: Request) {
  return handle(req, process.env);
}
