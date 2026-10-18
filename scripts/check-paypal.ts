// Authenticates only with the official sandbox OAuth endpoint.
// Does not create invoices, send notifications or move funds.
import { checkSandboxConnection } from "../lib/paypal";
void checkSandboxConnection().then(result => console.log(JSON.stringify(result))).catch(error => { console.error((error as Error).message); process.exitCode = 1; });
