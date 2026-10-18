import { verifyWebhook, verifyPaid } from "@/lib/paypal";
import { transaction } from "@/lib/store";
import { activatePaid } from "@/lib/domain";
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 200000) return new Response("Too large", { status: 413 });
    const event = JSON.parse(text);
    if (!await verifyWebhook(request, event)) return new Response("Invalid signature", { status: 403 });
    if (!["INVOICING.INVOICE.PAID", "PAYMENT.CAPTURE.COMPLETED"].includes(event.event_type)) return Response.json({ received: true });
    if (typeof event.id !== "string" || !event.resource?.id) return new Response("Invalid event", { status: 400 });
    const orderId = event.resource.supplementary_data?.related_ids?.order_id;
    const proposal = await transaction(w => w.proposals.find(p => p.mode === "sandbox" && (event.event_type === "INVOICING.INVOICE.PAID" ? p.invoiceId === event.resource.id : typeof orderId === "string" && p.orderId === orderId)));
    if (!proposal || proposal.status === "paid") return Response.json({ received: true });
    if (!await verifyPaid(proposal)) return new Response("Invoice does not match approved terms", { status: 409 });
    await transaction(w => { const p = w.proposals.find(p => p.id === proposal.id)!; activatePaid(w, p, event.id); });
    return Response.json({ received: true });
  } catch { return new Response("Unable to verify payment. PayPal may retry.", { status: 503 }); }
}
