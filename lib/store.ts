import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { seed } from "./seed";
import type { Workspace } from "./types";

const directory = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const file = path.join(directory, "workspace.json");
// A single process owns this MVP store. Production needs a persistent volume.
const state = globalThis as typeof globalThis & { scopepayQueue?: Promise<unknown>; scopepayLatest?: string };
async function load() {
  try { return await readFile(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return JSON.stringify(seed()); }
}
// Reads skip the queue so a slow PayPal call cannot block pages. They use the last saved copy
// in memory because on Windows an open read makes the atomic rename fail with EPERM.
export async function snapshot(): Promise<Workspace> {
  state.scopepayLatest ||= await load();
  return JSON.parse(state.scopepayLatest);
}
export function transaction<T>(fn: (workspace: Workspace) => T | Promise<T>): Promise<T> {
  const result = (state.scopepayQueue || Promise.resolve()).then(async () => {
    const workspace: Workspace = JSON.parse(await load());
    const output = await fn(workspace);
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.tmp`;
    const json = JSON.stringify(workspace, null, 2);
    await writeFile(temporary, json, { mode: 0o600 });
    await rename(temporary, file);
    state.scopepayLatest = json;
    return output;
  });
  state.scopepayQueue = result.catch(() => undefined);
  return result;
}
