// Expose machine-readable provider codes, never raw response bodies, headers,
// credentials, recipient details or request payloads.
export function paypalErrorMessage(status: number, body: unknown) {
  const value = body as { name?: unknown; error?: unknown; details?: { issue?: unknown }[] } | null;
  const codes = [value?.name, value?.error, ...(Array.isArray(value?.details) ? value.details.map(item => item.issue) : [])]
    .filter((code): code is string => typeof code === "string" && /^[a-zA-Z][a-zA-Z_]{1,100}$/.test(code));
  return `PayPal Sandbox could not complete this step (${status}${codes.length ? `: ${[...new Set(codes)].join(", ")}` : ""}). Your approval is saved; existing invoice links are preserved.`;
}
