// Opt-in network test: sends ONLY the fixed fictional Bloom Bakery fixture.
// Never loads saved workspace/client data or prints credentials.
import { analyze } from "../lib/analysis";
import { seed } from "../lib/seed";
async function main() {
if (!process.env.GROQ_API_KEY) throw new Error("Add GROQ_API_KEY to .env.local first.");
try {
  const result = await analyze(seed().projects[0].scope, "For our first visual revision, change the heading colour to green. Also add appointment booking for cake tastings");
  console.log(JSON.stringify(result, null, 2));
  if (!result.items.some(i => i.classification === "included") || !result.items.some(i => i.classification === "additional")) process.exitCode = 1;
} catch (error) {
  const value = error as Error & { cause?: { code?: string; message?: string } };
  console.error("Groq check failed:", value.message, "Network code:", value.cause?.code || "none");
  process.exitCode = 1;
}
}
void main();
