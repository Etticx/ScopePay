import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { seed } from "./seed";
import type { Workspace } from "./types";

const directory = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const file = path.join(directory, "workspace.json");
// A single process owns this MVP store. Production needs a persistent volume.
const state = globalThis as typeof globalThis & { scopepayQueue?: Promise<unknown> };
async function read(): Promise<Workspace> {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return seed(); }
}
export function transaction<T>(fn: (workspace: Workspace) => T | Promise<T>): Promise<T> {
  const result = (state.scopepayQueue || Promise.resolve()).then(async () => {
    const workspace = await read();
    const output = await fn(workspace);
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.tmp`;
    await writeFile(temporary, JSON.stringify(workspace, null, 2), { mode: 0o600 });
    await rename(temporary, file);
    return output;
  });
  state.scopepayQueue = result.catch(() => undefined);
  return result;
}
