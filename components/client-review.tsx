"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, CalendarDays, Check, CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { Logo, Spinner, Status } from "./ui";
import { money, dateLabel, lockedTasks } from "@/lib/domain";
import type { PublicProposal } from "@/lib/types";
const Timeline = dynamic(() => import("./timeline"), { ssr: false, loading: () => <div className="loading-inline"><Spinner /> Loading…</div> });

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
      if (!result.paid) setNotice("Payment not confirmed yet.");
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
      if (query.get("checkout") === "cancel") setNotice("Checkout cancelled.");
      load().catch(e => setError(e.message));
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  async function decide(decision: "approve" | "decline" | "revise") {
    if (!data) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/client/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, version: data.proposal.version, note }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setNotice(result.notice || "Response saved."); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="client-shell"><header className="client-header"><a href="/" aria-label="ScopePay home"><Logo /></a></header><main className="client-main">
    {!data ? <div className="panel client-card">{error ? <><h1>We couldn’t open this proposal</h1><p className="muted">{error}</p></> : <Spinner />}</div> : <>
      <h1>{data.project.name}</h1>
      <div className="panel client-card"><div className="section-head"><span className="eyebrow">Proposal v{data.proposal.version}</span><Status value={data.proposal.status} /></div><h2>{data.proposal.title}</h2><p className="proposal-description">{data.proposal.description}</p><div className="client-totals"><div><span className="muted small">Price</span><strong>{money(data.proposal.totalCents)} <small>USD</small></strong><span className="muted small">{data.proposal.hours} hours × {money(Math.round(data.proposal.rate * 100))}/hr</span></div><div><span className="muted small">Delivery</span><strong className="delivery-date"><CalendarDays size={22} />{dateLabel(data.proposal.deadline)}</strong><span className="muted small">{data.proposal.extraDays ? `+${data.proposal.extraDays} days` : "Same deadline"}</span></div></div>
        {data.proposal.mode === "demo" && <div className="notice"><ShieldCheck size={18} /><span>Demo. No money is collected.</span></div>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-note" role="status"><Check size={16} />{notice}</p>}
        {data.proposal.status === "shared" && <div className="client-actions"><label className="check-label"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I agree to the work, price and delivery date.</label><button className="button primary full" disabled={!accepted || busy} onClick={() => decide("approve")}>{busy ? <Spinner /> : <Check size={18} />}Approve</button><label className="field"><span>Note</span><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000} /></label><div className="client-secondary"><button className="button secondary" disabled={busy} onClick={() => decide("revise")}><MessageSquare size={16} />Request changes</button><button className="text-button" disabled={busy} onClick={() => decide("decline")}>Decline</button></div></div>}
        {data.proposal.status === "approved" && <div className="approved-state"><CheckCircle2 size={24} /><h3>{busy ? "Confirming payment…" : data.proposal.mode === "sandbox" && !data.proposal.paymentUrl ? "Payment link pending" : "Approved"}</h3>{busy ? <Spinner /> : data.proposal.paymentUrl && <a className="button primary" href={data.proposal.paymentUrl} rel="noreferrer">Pay with PayPal Sandbox <ArrowUpRight size={17} /></a>}<button className="text-button" disabled={busy} onClick={() => { const query = new URLSearchParams(window.location.search); const returnedOrder = query.get("checkout") === "return" ? query.get("token") : null; if (data.proposal.mode === "sandbox") void refreshPayment(returnedOrder || data.proposal.orderId); else load().catch(e => setError(e.message)); }}>Refresh</button></div>}
        {data.proposal.status === "paid" && <div className="approved-state"><CheckCircle2 size={32} /><h3>{data.proposal.mode === "demo" ? "Demo payment complete" : "Paid"}</h3>{data.proposal.scheduleReview && <p className="muted">Schedule under review.</p>}</div>}
        
        
      </div>
      {["shared", "approved", "paid"].includes(data.proposal.status) && <div className="panel client-card client-timeline"><div className="section-head"><h2>Timeline</h2></div><Timeline project={data.project} locked={data.proposal.status === "paid" ? [] : lockedTasks(data.project, data.proposal)} /></div>}
    </>}
  </main></div>;
}
