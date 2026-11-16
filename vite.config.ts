import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";
import { handle } from "./server/ask";

// Serves the Vercel function at /api/ask during development, with keys from .env.local.
function askApi(env: Record<string, string>): Plugin {
  return {
    name: "ask-api",
    configureServer(server) {
      server.middlewares.use("/api/ask", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        const r = await handle(new Request("http://localhost/api/ask", { method: req.method, headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined }), env);
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await r.text());
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), wgslVitePlugin(), askApi({ ...loadEnv(mode, process.cwd(), ""), ASK_DEV: "1" })],
  server: { port: 5183, strictPort: true },
}));
