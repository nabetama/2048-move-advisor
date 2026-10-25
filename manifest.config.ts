import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json" with { type: "json" };


const matches = ["https://play2048.co/*", "https://www.play2048.co/*"];

export default defineManifest({
  manifest_version: 3,
  name: "2048 Move Advisor",
  version: packageJson.version,
  description: "Reads the play2048.co board and recommends the next move, prioritizing the 2048 tile.",
  content_scripts: [{
    matches,
    js: ["src/content.ts"],
    run_at: "document_idle",
  }],
});
