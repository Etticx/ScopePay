"use client";
import { useState } from "react";
import { FileCheck2 } from "lucide-react";
import { money } from "@/lib/domain";
import type { Project, Proposal, ScopeRequest } from "@/lib/types";
import { Spinner } from "./ui";

export default function ProposalForm({
  request,
  proposal,
  project,
  busy,
  error,
  onSave,
}: {
  request: ScopeRequest;
  proposal?: Proposal;
  project: Project;
  busy: boolean;
  error: string;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const additional = request.items.filter((i) => i.classification === "additional");
  // The owner may price an unclear item once the client has explained it.
  const extra = additional.length ? additional : request.items.filter((i) => i.classification === "clarify");
  const [hours, setHours] = useState(proposal?.hours || extra.reduce((sum, i) => sum + i.hours, 0) || 1);
  const [rate, setRate] = useState(proposal?.rate || project.rate);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({ title: f.get("title"), description: f.get("description"), hours, rate, extraDays: Number(f.get("extraDays")) });
      }}
    >
      <label className="field">
        <span>Title</span>
        <input
          name="title"
          defaultValue={proposal?.title || extra.map((i) => i.title).join(" & ")}
          minLength={3}
          maxLength={160}
          required
        />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={proposal?.description || extra.map((i) => `${i.title}. ${i.reason}`).join("\n")}
          minLength={10}
          maxLength={2000}
          required
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Hours</span>
          <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} min="0.25" max="200" step="0.25" required />
        </label>
        <label className="field">
          <span>Hourly rate (USD)</span>
          <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} min="1" max="10000" step="0.01" required />
        </label>
        <label className="field span-two">
          <span>Extra days</span>
          <input type="number" name="extraDays" defaultValue={proposal?.extraDays ?? 2} min="0" max="180" required />
        </label>
      </div>
      <div className="quote-total">
        <span>Total</span>
        <strong>{money(Math.round(hours * Math.round(rate * 100)))}</strong>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-footer">
        <button className="button primary" disabled={busy}>
          {busy ? <Spinner /> : <FileCheck2 size={16} />}Save
        </button>
      </div>
    </form>
  );
}
