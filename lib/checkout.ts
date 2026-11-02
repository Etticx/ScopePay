import { transaction } from "./store";
import { activatePaid } from "./domain";
import { captureOrder, createOrder, orderGone, verifyPaid } from "./paypal";

export async function ensurePayment(id: string, origin: string) {
  try {
    await transaction(async w => {
      const p = w.proposals.find(p => p.id === id);
      if (!p || p.status !== "approved" || p.mode !== "sandbox") throw new Error("Only an approved sandbox proposal can be paid.");
      const project = w.projects.find(project => project.id === p.projectId)!;
      if (project.email.toLowerCase() === process.env.PAYPAL_SELLER_EMAIL?.toLowerCase()) throw new Error("Use a separate sandbox Personal buyer email for the client. The business seller cannot pay itself.");
      if (p.orderId && await orderGone(p.orderId)) {
        delete p.orderId; delete p.paymentUrl;
        p.paymentAttempt = (p.paymentAttempt || 0) + 1;
      }
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
    if (!p.orderId) return false;
    const paid = returnedOrderId !== undefined ? await captureOrder(p) : await verifyPaid(p);
    if (paid) activatePaid(w, p, `sandbox-${p.id}`);
    return paid;
  });
}
