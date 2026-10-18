import { transaction } from "./store";
import { activatePaid } from "./domain";
import { captureOrder, createOrder, verifyPaid } from "./paypal";
import { ensureInvoice } from "./invoice";

export async function ensurePayment(id: string, origin: string) {
  const legacy = await transaction(w => w.proposals.find(p => p.id === id)?.invoiceId);
  // Never create a second way to charge a proposal already attached to an invoice.
  if (legacy) return ensureInvoice(id);
  try {
    await transaction(async w => {
      const p = w.proposals.find(p => p.id === id);
      if (!p || p.status !== "approved" || p.mode !== "sandbox") throw new Error("Only an approved sandbox proposal can be paid.");
      if (!p.orderId) {
        const order = await createOrder(p, origin);
        p.orderId = order.id; p.paymentUrl = order.url;
      }
      delete p.invoiceError;
    });
  } catch (error) {
    await transaction(w => { const p = w.proposals.find(p => p.id === id); if (p?.status === "approved" && !p.paymentUrl) p.invoiceError = (error as Error).message; });
    throw error;
  }
}

export async function confirmPayment(id: string, returnedOrderId?: string) {
  return transaction(async w => {
    const p = w.proposals.find(p => p.id === id);
    if (!p || p.mode !== "sandbox" || !["approved", "paid"].includes(p.status)) throw new Error("No approved sandbox payment found.");
    if (returnedOrderId !== undefined && (!p.orderId || returnedOrderId !== p.orderId)) throw new Error("The returned checkout does not belong to this proposal.");
    if (p.status === "paid") return true;
    if (!p.orderId && !p.invoiceId) return false;
    const paid = returnedOrderId !== undefined ? await captureOrder(p) : await verifyPaid(p);
    if (paid) activatePaid(w, p, `sandbox-${p.id}`);
    return paid;
  });
}
