import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Scheduling is timezone-sensitive and the bug these tests exist to catch
    // only appears when the server zone differs from the school's. Pin the
    // process to UTC to mirror Vercel, and never to Europe/London — that would
    // let a regression pass locally.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
