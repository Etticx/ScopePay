import { transaction } from "./store";
import { createInvoice, sendInvoice } from "./paypal";
import { integrationStatus } from "./auth";

export async function ensureInvoice(id: string) {
  if (!integrationStatus().paypal) throw new Error("Connect PayPal Sandbox before preparing an invoice.");
  try {
  // Persist the created invoice BEFORE sending, so retries reuse the same invoice.
  const invoiceId = await transaction(async w => {
    const p = w.proposals.find(p => p.id === id);
    if (!p || p.status !== "approved" || p.mode !== "sandbox") throw new Error("Only an approved sandbox proposal can be invoiced.");
    if (!p.invoiceId) {
      const project = w.projects.find(project => project.id === p.projectId)!;
      if (project.email.toLowerCase() === process.env.PAYPAL_SELLER_EMAIL?.toLowerCase()) throw new Error("Use a separate sandbox Personal buyer email for the client. The business seller cannot pay its own invoice.");
      p.invoiceId = await createInvoice(p, project);
    }
    return p.invoiceId;
  });
  const url = await sendInvoice(invoiceId);
  await transaction(w => { const p = w.proposals.find(p => p.id === id)!; p.paymentUrl = url; delete p.invoiceError; });
  } catch (error) {
    await transaction(w => {
      const p = w.proposals.find(p => p.id === id);
      if (p && p.status === "approved" && !p.paymentUrl) p.invoiceError = (error as Error).message;
    });
    throw error;
  }
}
