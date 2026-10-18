// Read-only sandbox diagnostics. Never prints tokens, secrets, emails or invoices.
async function main() {
  const base = "https://api-m.sandbox.paypal.com";
  const tokenBody = new URLSearchParams({ grant_type: "client_credentials" });
  // Use only after changing app permissions to refresh PayPal's cached grant.
  if (process.argv.includes("--fresh-token")) tokenBody.set("ignoreCache", "true");
  const auth = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody, signal: AbortSignal.timeout(30000) });
  const token = await auth.json();
  const scopes = String(token.scope || "").split(" ").filter((scope: string) => scope.includes("invoicing"));
  console.log(JSON.stringify({ oauthStatus: auth.status, invoicingScopes: scopes }));
  if (!auth.ok) return;
  const response = await fetch(`${base}/v2/invoicing/invoices?page_size=1`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(30000) });
  if (response.ok) { console.log(JSON.stringify({ listInvoicesStatus: response.status })); return; }
  const error = await response.json().catch(() => ({}));
  console.log(JSON.stringify({ listInvoicesStatus: response.status, errorCode: error.name || error.error, message: error.message || error.error_description, issues: error.details?.map((detail: { issue?: string }) => detail.issue) }));
}
void main().catch(error => { console.error("Sandbox diagnostic failed:", (error as Error).message); process.exitCode = 1; });
