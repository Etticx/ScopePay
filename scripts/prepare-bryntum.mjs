import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

// Keep the large vendor evaluation bundle outside Next.js compilation.
// These generated assets are ignored by Git; npm install recreates them.
const source = path.resolve("node_modules/@bryntum/gantt-trial");
const target = path.resolve("public/vendor/bryntum");
await mkdir(target, { recursive: true });
for (const name of ["gantt.module.js", "gantt.css", "stockholm-light.css", "fonts", "fontawesome"]) {
  await cp(path.join(source, name), path.join(target, name), { recursive: true, force: true });
}
console.log("Bryntum evaluation assets prepared for on-demand loading.");
