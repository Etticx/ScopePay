// Retry only failures that occur while establishing a connection, before a
// request is sent. Never automatically retry HTTP errors or ambiguous resets.
export async function fetchExternal(url: string, init: RequestInit, request: typeof fetch = fetch) {
  for (let attempt = 0; ; attempt++) {
    try { return await request(url, init); }
    catch (error) {
      const code = (error as Error & { cause?: { code?: string } }).cause?.code;
      if (attempt >= 2 || !["UND_ERR_CONNECT_TIMEOUT", "EAI_AGAIN", "ENETUNREACH"].includes(code || "")) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
}
