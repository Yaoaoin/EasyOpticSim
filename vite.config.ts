import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
function engineBridge(): Plugin {
  return {
    name: "local-rust-engine",
    configureServer(server) {
      server.middlewares.use("/api", (req, res) => {
        if (
          req.headers.origin &&
          ![
            `http://localhost:${server.config.server.port}`,
            `http://127.0.0.1:${server.config.server.port}`,
          ].includes(req.headers.origin)
        ) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (
          req.method !== "POST" ||
          req.headers["content-type"] !== "application/json"
        ) {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        const streaming = req.url === "/compute-progress";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 4_000_000) req.destroy();
        });
        req.on("end", () => {
          const child = spawn(
            resolve(
              "target/debug/easyopticsim-cli" +
                (process.platform === "win32" ? ".exe" : ""),
            ),
            [
              req.url === "/examples"
                ? "examples"
                : streaming
                  ? "--request-progress"
                  : "--request",
            ],
          );
          let out = "",
            err = "";
          if (streaming) res.setHeader("Content-Type", "application/x-ndjson");
          child.stdout.on("data", (d) =>
            streaming ? res.write(d) : (out += d),
          );
          child.stderr.on("data", (d) => (err += d));
          res.on("close", () => child.kill());
          child.on("error", () => {
            res.statusCode = 503;
            res.end(
              JSON.stringify({
                error: "Rust 引擎尚未构建。请运行 cargo build -p easyopticsim-cli。",
              }),
            );
          });
          child.on("close", (code) => {
            if (res.writableEnded) return;
            if (streaming) {
              if (code !== 0)
                res.write(
                  JSON.stringify({ error: err || "计算已终止" }) + "\n",
                );
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.statusCode = code === 0 ? 200 : 422;
            res.end(
              code === 0 ? out : err || JSON.stringify({ error: "计算已终止" }),
            );
          });
          child.stdin.on("error", () => {});
          child.stdin.end(body);
        });
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), engineBridge()],
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/target/**",
        "**/.tools/**",
        "**/src-tauri/**",
        "**/artifacts/**",
      ],
    },
  },
  clearScreen: false,
});
