import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDirectory = resolve("dist");
const manifest = JSON.parse(await readFile(resolve(distDirectory, "manifest.json"), "utf8"));
const contentScripts = manifest.content_scripts?.flatMap((entry) => entry.js ?? []) ?? [];

if (!contentScripts.length) {
  throw new Error("The built manifest does not declare a content script.");
}

const resources = manifest.web_accessible_resources?.flatMap((entry) => entry.resources) ?? [];
const scriptFiles = [...new Set([...contentScripts, ...resources])];
const scriptSources = await Promise.all(
  scriptFiles.map((file) => readFile(resolve(distDirectory, file), "utf8")),
);

if (scriptSources.some((source) => source.includes("import.meta"))) {
  throw new Error("The built extension scripts must not contain import.meta.");
}
if (!resources.some((resource) => resource.includes("worker"))) {
  throw new Error("The built manifest does not expose the worker resource.");
}

if (!scriptSources.some((source) => source.includes("new Worker(chrome.runtime.getURL("))) {
  throw new Error("The built content script does not create the worker from an extension URL.");
}

console.log("Built extension resources verified.");
