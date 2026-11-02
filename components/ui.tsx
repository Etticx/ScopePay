"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, X, ArrowRightLeft, LoaderCircle } from "lucide-react";
import type { ProposalStatus } from "@/lib/types";

export function Logo() { return <span className="logo"><span className="logo-mark"><ArrowRightLeft size={20} strokeWidth={2.4} /></span><span>scope<span className="logo-light">pay</span><span className="logo-dot">.</span></span></span>; }
export function Spinner() { return <LoaderCircle size={17} className="spin" aria-label="Loading" />; }
export function Modal({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" aria-describedby={undefined}><Dialog.Title className="dialog-title">{title}</Dialog.Title><Dialog.Close className="icon-button dialog-close" aria-label="Close dialog"><X size={20} /></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
const statuses: Record<ProposalStatus, string> = { draft: "Draft", shared: "Awaiting approval", approved: "Awaiting payment", declined: "Declined", revision_requested: "Revision requested", paid: "Paid & agreed" };
export function Status({ value }: { value: ProposalStatus }) { return <span className={`badge ${value === "paid" ? "green" : value === "approved" || value === "shared" ? "amber" : "neutral"}`}><span className="status-dot" />{statuses[value]}</span>; }
export function Empty({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="empty"><div className="empty-icon"><ArrowUpRight size={26} /></div><h3>{title}</h3>{action}</div>; }
