import { snapshot, transaction } from "./store";
import { activatePaid } from "./domain";
import { captureOrder, createOrder, orderGone, verifyPaid } from "./paypal";

export async function ensurePayment(id: string, origin: string) {
  try {
    const w = await snapshot();
    const p = w.proposals.find(p => p.id === id);
    if (!p || p.status !== "approved" || p.mode !== "sandbox") throw new Error("Only an approved sandbox proposal can be paid.");
    const project = w.projects.find(project => project.id === p.projectId)!;
    if (project.email.toLowerCase() === process.env.PAYPAL_SELLER_EMAIL?.toLowerCase()) throw new Error("Use a separate sandbox Personal buyer email for the client. The business seller cannot pay itself.");
    // PayPal calls run outside the save queue so a slow sandbox cannot stall other saves.
    // A concurrent call reuses the same PayPal-Request-Id, so it gets the same order back.
    let attempt = p.paymentAttempt || 0;
    let order: { id: string; url: string } | undefined;
    if (!p.orderId || await orderGone(p.orderId)) {
      if (p.orderId) attempt++;
      order = await createOrder({ ...p, paymentAttempt: attempt }, origin);
    }
    await transaction(w => {
      const current = w.proposals.find(item => item.id === id);
      if (!current || current.status !== "approved" || current.version !== p.version || (current.orderId !== p.orderId && current.orderId !== order?.id)) throw new Error("This proposal changed while preparing payment. Retry.");
      if (order) { current.orderId = order.id; current.paymentUrl = order.url; current.paymentAttempt = attempt; }
      delete current.invoiceError;
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
    if (!p.orderId) return false;
    const paid = returnedOrderId !== undefined ? await captureOrder(p) : await verifyPaid(p);
    if (paid) activatePaid(w, p, `sandbox-${p.id}`);
    return paid;
  });
}
