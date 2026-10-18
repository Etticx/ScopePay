"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, CheckCircle2, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";
import { Logo, Spinner, Status } from "./ui";
import { money, dateLabel } from "@/lib/domain";
import type { PublicProposal } from "@/lib/types";

export default function ClientReview({ token }: { token: string }) {
  const [data, setData] = useState<PublicProposal>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const handledReturn = useRef("");
  const load = async () => { const response = await fetch(`/api/client/${token}`, { cache: "no-store" }); const value = await response.json(); if (!response.ok) throw new Error(value.error); setData(value); };
  async function refreshPayment(orderId?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/client/${token}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderId ? { orderId } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      if (!result.paid) setNotice("PayPal has not confirmed full payment yet. You can check again shortly.");
      else window.history.replaceState(null, "", window.location.pathname);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (handledReturn.current === token) return;
    handledReturn.current = token;
    const query = new URLSearchParams(window.location.search);
    const returnedOrder = query.get("token");
    if (query.get("checkout") === "return" && returnedOrder) {
      void load().then(() => refreshPayment(returnedOrder)).catch(e => setError(e.message));
    } else {
      if (query.get("checkout") === "cancel") setNotice("You cancelled checkout. Your proposal is still approved; you can pay when you’re ready.");
      load().catch(e => setError(e.message));
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  async function decide(decision: "approve" | "decline" | "revise") {
    if (!data) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/client/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, version: data.proposal.version, note }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setNotice(result.notice || "Your response has been saved. Thank you!"); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="client-shell"><header className="client-header"><a href="/" aria-label="ScopePay home"><Logo /></a><span className="muted small"><LockKeyhole size={14} /> Private proposal</span></header><main className="client-main">
    {!data ? <div className="panel client-card">{error ? <><h1>We couldn’t open this proposal</h1><p className="muted">{error}</p></> : <Spinner />}</div> : <>
      <div className="eyebrow">A little clarity, before we get started</div><h1>Good work starts<br />with a clear agreement.</h1><p className="muted client-intro">Hi {data.project.client.split(" ")[0]}, here’s the proposed addition to <strong>{data.project.name}</strong>.</p>
      <div className="panel client-card"><div className="section-head"><span className="eyebrow">Change proposal · v{data.proposal.version}</span><Status value={data.proposal.status} /></div><h2>{data.proposal.title}</h2><p className="proposal-description">{data.proposal.description}</p><div className="client-totals"><div><span className="muted small">Additional investment</span><strong>{money(data.proposal.totalCents)} <small>USD</small></strong><span className="muted small">{data.proposal.hours} hours × {money(Math.round(data.proposal.rate * 100))}/hr</span></div><div><span className="muted small">Proposed delivery</span><strong className="delivery-date"><CalendarDays size={22} />{dateLabel(data.proposal.deadline)}</strong><span className="muted small">{data.proposal.extraDays ? `${data.proposal.extraDays} additional calendar days` : "No deadline extension"}</span></div></div>
        {data.proposal.mode === "demo" && <div className="notice"><ShieldCheck size={18} /><span><strong>Demo proposal.</strong> No money will be collected. Your freelancer can simulate payment in the demo workspace.</span></div>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-note" role="status"><Check size={16} />{notice}</p>}
        {data.proposal.status === "shared" && <div className="client-actions"><label className="check-label"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I agree to the work, price and delivery date in this version.</label><button className="button primary full" disabled={!accepted || busy} onClick={() => decide("approve")}>{busy ? <Spinner /> : <Check size={18} />}Approve this proposal</button><label className="field"><span>Questions or changes? <span className="muted">Optional</span></span><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Leave a note for your freelancer…" maxLength={1000} /></label><div className="client-secondary"><button className="button secondary" disabled={busy} onClick={() => decide("revise")}><MessageSquare size={16} />Request a revision</button><button className="text-button" disabled={busy} onClick={() => decide("decline")}>Decline proposal</button></div></div>}
        {data.proposal.status === "approved" && <div className="approved-state"><CheckCircle2 size={24} /><h3>{busy ? "Confirming your payment…" : data.proposal.mode === "sandbox" && !data.proposal.paymentUrl ? "Approval saved. Payment link pending." : "Your approval is saved."}</h3><p className="muted">{data.proposal.mode === "sandbox" ? (data.proposal.paymentUrl ? (data.proposal.orderId ? "Complete checkout on PayPal. You’ll return here automatically so we can confirm payment and update your project plan." : "After paying this invoice on PayPal, return here and refresh payment status.") : "Your freelancer needs to finish preparing PayPal payment. Refresh here once it is ready.") : "This is a demo. Your freelancer can now simulate the payment step."}</p>{busy ? <Spinner /> : data.proposal.paymentUrl && <a className="button primary" href={data.proposal.paymentUrl} rel="noreferrer">Pay with PayPal Sandbox <ArrowUpRight size={17} /></a>}<button className="text-button" disabled={busy} onClick={() => { const query = new URLSearchParams(window.location.search); const returnedOrder = query.get("checkout") === "return" ? query.get("token") : null; if (data.proposal.mode === "sandbox") void refreshPayment(returnedOrder || undefined); else load().catch(e => setError(e.message)); }}>Refresh payment status</button></div>}
        {data.proposal.status === "paid" && <div className="approved-state"><CheckCircle2 size={32} /><h3>{data.proposal.mode === "demo" ? "Demo payment completed" : "Sandbox payment confirmed"}</h3><p className="muted">{data.proposal.scheduleReview ? "Your payment is saved. Your freelancer will reconfirm the schedule because the original dates have changed." : "Your agreed addition is now in the project plan."}</p></div>}
        {data.proposal.status === "revision_requested" && <p className="muted">Your freelancer will prepare an updated proposal for you to review.</p>}
        {data.proposal.status === "declined" && <p className="muted">The original project agreement remains unchanged.</p>}
      </div><p className="client-footnote"><ShieldCheck size={15} /> Your response is saved against this exact proposal version.</p>
    </>}
  </main><footer className="client-footer">Made for better client relationships. <span>ScopePay</span></footer></div>;
}
