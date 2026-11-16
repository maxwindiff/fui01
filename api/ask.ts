import { handle } from "../server/ask";

export const config = { maxDuration: 60 };

export function POST(req: Request) {
  return handle(req, process.env);
}
