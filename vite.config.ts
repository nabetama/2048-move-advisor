import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vitest/config";
import manifest from "./manifest.config.ts";

export default defineConfig({
  plugins: [crx({ manifest })],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
