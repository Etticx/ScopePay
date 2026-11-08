"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import type { IntegrationStatus, Project, Proposal, ScopeRequest, Workspace } from "@/lib/types";
import { dateLabel, lockedTasks, money } from "@/lib/domain";
import { Empty, Logo, Modal, Spinner, Status } from "./ui";
import Connections from "./connections";
import ProposalForm from "./proposal-form";
const Timeline = dynamic(() => import("./timeline"), {
  ssr: false,
  loading: () => (
    <div className="loading-inline">
      <Spinner /> Loading…
    </div>
  ),
});
type View = "overview" | "projects" | "requests" | "proposals" | "timeline" | "settings";
const navigation = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "projects" as const, label: "Projects", icon: FolderKanban },
  { id: "requests" as const, label: "Client requests", icon: MessageSquare },
  { id: "proposals" as const, label: "Proposals", icon: FileCheck2 },
  { id: "timeline" as const, label: "Timeline", icon: CalendarDays },
];
const labels = { included: "Included", additional: "Additional work", clarify: "Needs clarification" };

async function api(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
export default function Dashboard() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [integrations, setIntegrations] = useState<IntegrationStatus>({ groq: false, paypal: false, webhook: false, protected: false });
  const [view, setView] = useState<View>("overview");
  const [projectId, setProjectId] = useState("p-bloom");
  const [requestId, setRequestId] = useState<string>();
  const [projectDetail, setProjectDetail] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [requestModal, setRequestModal] = useState(false);
  const [editing, setEditing] = useState<{ request: ScopeRequest; proposal?: Proposal }>();
  const [share, setShare] = useState<Proposal>();
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [login, setLogin] = useState(false);
  const [mobile, setMobile] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) {
      setLogin(true);
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not open workspace.");
    setWorkspace(result.workspace);
    setIntegrations(result.integrations);
    setLogin(false);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: View) {
    setView(next);
    setProjectDetail(false);
    setRequestId(undefined);
    setQuery("");
    setMobile(false);
  }
  function openRequest(r: ScopeRequest) {
    setRequestId(r.id);
    setProjectId(r.projectId);
    setView("requests");
  }
  function openProject(p: Project) {
    setProjectId(p.id);
    setProjectDetail(true);
    setView("projects");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
    } catch {
      setToast("Select the link and copy it manually.");
    }
  }

  if (login)
    return (
      <div className="login-shell">
        <div className="panel login-card">
          <Logo />
          <h1>Sign in</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              run(async () => {
                await api("/api/auth", { password: form.get("password") });
                await load();
              });
            }}
          >
            <label className="field">
              <span>Password</span>
              <input type="password" name="password" autoComplete="current-password" required autoFocus />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button primary full" disabled={busy}>
              {busy ? <Spinner /> : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  if (!workspace)
    return (
      <div className="app-loading">
        <Logo />
        {error ? (
          <>
            <p className="form-error">{error}</p>
            <button className="button secondary" onClick={() => load().catch((e) => setError(e.message))}>
              Try again
            </button>
          </>
        ) : (
          <span className="loading-inline">
            <Spinner /> Loading…
          </span>
        )}
      </div>
    );
  const w = workspace;
  const project = w.projects.find((p) => p.id === projectId) || w.projects[0];
  const selectedRequest = w.requests.find((r) => r.id === requestId);
  const paid = w.proposals.filter((p) => p.status === "paid" && (!integrations.paypal || p.mode === "sandbox"));
  const unresolved = w.requests.filter(
    (r) =>
      r.items.some((i) => i.classification === "additional") && !w.proposals.some((p) => p.requestId === r.id && p.status !== "declined"),
  );
  const filteredProjects = w.projects.filter((p) => `${p.name} ${p.client}`.toLowerCase().includes(query.toLowerCase()));
  const action = (body: unknown) => api("/api/action", body);

  function proposalButtons(p: Proposal) {
    const request = w.requests.find((r) => r.id === p.requestId)!;
    return (
      <div className="row-actions">
        {["draft", "revision_requested"].includes(p.status) && (
          <button className="button secondary small-button" disabled={busy} onClick={() => setEditing({ request, proposal: p })}>
            Edit proposal
          </button>
        )}
        {p.status === "draft" && (
          <button
            className="button primary small-button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await action({ action: "shareProposal", id: p.id });
                await load();
                setShare(result.result);
              })
            }
          >
            Share with client <ArrowUpRight size={15} />
          </button>
        )}
        {p.status !== "draft" && (
          <button className="button secondary small-button" onClick={() => setShare(p)}>
            Client link <ArrowUpRight size={15} />
          </button>
        )}
        {p.status === "approved" && (
          <>
            {p.mode === "demo" ? (
              <button
                className="button primary small-button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await action({ action: "simulatePayment", id: p.id });
                    await load();
                    setToast("Payment simulated.");
                  })
                }
              >
                Simulate demo payment
              </button>
            ) : (
              <>
                <button
                  className="button secondary small-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await action({ action: "preparePayment", id: p.id });
                      await load();
                      setToast("PayPal sandbox payment is ready.");
                    })
                  }
                >
                  Prepare checkout
                </button>
                <button
                  className="button primary small-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await action({ action: "checkPayment", id: p.id });
                      await load();
                      setToast("PayPal sandbox payment verified.");
                    })
                  }
                >
                  Check payment
                </button>
              </>
            )}
          </>
        )}
        {p.status === "paid" && (
          <button
            className="text-button"
            onClick={() => {
              setProjectId(p.projectId);
              navigate("timeline");
            }}
          >
            View timeline <ArrowRight size={15} />
          </button>
        )}
      </div>
    );
  }

  function projectCard(p: Project, index: number) {
    const count = w.requests.filter((r) => r.projectId === p.id).length;
    const progress = Math.round(p.tasks.reduce((total, t) => total + t.progress, 0) / Math.max(1, p.tasks.length));
    return (
      <button className="project-card" key={p.id} onClick={() => openProject(p)}>
        <div className="project-card-top">
          <span className={`project-avatar tone-${index % 3}`}>{p.initials}</span>
        </div>
        <h3>{p.name}</h3>
        <p className="muted small">{p.client}</p>
        <div className="project-progress">
          <div>
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="project-meta">
          <span>
            <CalendarDays size={14} />
            {dateLabel(p.deadline)}
          </span>
          <span>
            <MessageSquare size={14} />
            {count} request{count !== 1 ? "s" : ""}
          </span>
          <ChevronRight size={17} />
        </div>
      </button>
    );
  }

  function requestRow(r: ScopeRequest) {
    const p = w.projects.find((p) => p.id === r.projectId)!;
    const classification = r.items.some((i) => i.classification === "additional")
      ? "additional"
      : r.items.some((i) => i.classification === "clarify")
        ? "clarify"
        : "included";
    const mixed = new Set(r.items.map((item) => item.classification)).size > 1;
    return (
      <button className="request-row" key={r.id} onClick={() => openRequest(r)}>
        <span className={`request-icon ${classification}`}>
          <MessageSquare size={18} />
        </span>
        <div className="request-row-copy">
          <strong>{r.items.length > 1 ? `${r.items.length} changes in one request` : r.items[0]?.title || "Client request"}</strong>
          <span className="muted small">{p?.name}</span>
        </div>
        <span
          className={`badge ${mixed ? "neutral" : classification === "included" ? "green" : classification === "additional" ? "lavender" : "amber"}`}
        >
          {mixed ? "Mixed request" : labels[classification]}
        </span>
        <ChevronRight size={16} />
      </button>
    );
  }

  return (
    <div className="app-shell">
      {mobile && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a className="brand" href="/" aria-label="ScopePay overview">
          <Logo />
        </a>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "requests" && unresolved.length > 0 && <span className="nav-count">{unresolved.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}>
            <Settings2 size={18} />
            Connections
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}>
              <Menu size={20} />
            </button>
            <span>Workspace</span>
          </div>
          <span className={`mode-pill ${integrations.paypal ? "connected" : ""}`}>
            <span className="status-dot" />
            {integrations.paypal ? "PayPal Sandbox" : "Demo mode"}
          </span>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button className="icon-button" onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {view === "overview" && (
            <div className="dashboard-overview">
              <div className="page-heading overview-heading">
                <h1>Overview</h1>
                <div className="overview-actions">
                  <button className="button secondary" onClick={() => setProjectModal(true)}>
                    New project
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      setMessage("");
                      setRequestModal(true);
                    }}
                  >
                    <Plus size={17} />
                    Review a request
                  </button>
                </div>
              </div>
              <div className="overview-summary" aria-label="Workspace summary">
                <span>
                  <strong>{w.projects.length}</strong> projects
                </span>
                <span>
                  <strong>{unresolved.length}</strong> to review
                </span>
                <span>
                  <strong>{money(paid.reduce((sum, p) => sum + p.totalCents, 0))}</strong>{" "}
                  {integrations.paypal ? "paid additions" : "demo additions"}
                </span>
              </div>
              {unresolved.length > 0 && (
                <section className="overview-section" aria-labelledby="review-heading">
                  <div className="section-head">
                    <h2 id="review-heading">Needs review</h2>
                    {unresolved.length > 3 && (
                      <button className="text-button" onClick={() => navigate("requests")}>
                        View all <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                  <div className="overview-list">
                    {unresolved.slice(0, 3).map((r) => (
                      <button className="overview-list-row" key={r.id} onClick={() => openRequest(r)}>
                        <span className="overview-row-copy">
                          <strong>
                            {r.items.find((item) => item.classification === "additional")?.title || r.items[0]?.title || "Client request"}
                          </strong>
                          <span>{w.projects.find((p) => p.id === r.projectId)?.name}</span>
                        </span>
                        <span className="overview-row-end review-link">
                          Review <ArrowRight size={16} />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="overview-section" aria-labelledby="projects-heading">
                <div className="section-head">
                  <h2 id="projects-heading">Projects</h2>
                  {w.projects.length > 4 && (
                    <button className="text-button" onClick={() => navigate("projects")}>
                      View all {w.projects.length} <ArrowRight size={15} />
                    </button>
                  )}
                </div>
                <div className="overview-list">
                  {w.projects.length ? (
                    w.projects.slice(0, 4).map((p) => (
                      <button className="overview-list-row" key={p.id} onClick={() => openProject(p)}>
                        <span className="overview-row-copy">
                          <strong>{p.name}</strong>
                          <span>{p.client}</span>
                        </span>
                        <span className="overview-row-end">
                          <span>Due {dateLabel(p.deadline)}</span>
                          <ChevronRight size={16} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="overview-empty">No projects</p>
                  )}
                </div>
              </section>
            </div>
          )}
          {view === "projects" && (
            <>
              <div className="page-heading">
                <div>
                  {projectDetail && (
                    <button className="text-button back-button" onClick={() => setProjectDetail(false)}>
                      <ChevronLeft size={16} />
                      All projects
                    </button>
                  )}
                  <h1>{projectDetail ? project.name : "Projects"}</h1>
                </div>
                <button className="button primary" onClick={() => (projectDetail ? setRequestModal(true) : setProjectModal(true))}>
                  <Plus size={17} />
                  {projectDetail ? "Review a request" : "New project"}
                </button>
              </div>
              {projectDetail ? (
                <>
                  <div className="panel scope-panel">
                    <div className="section-head">
                      <h2>Scope</h2>
                    </div>
                    <p className="scope-text">{project.scope}</p>
                    <div className="scope-meta">
                      <span>{project.client}</span>
                      <span>{project.email}</span>
                      <span>Budget {money(project.budget * 100)}</span>
                      <span>{money(project.rate * 100)}/hour</span>
                      <span>Due {dateLabel(project.deadline)}</span>
                    </div>
                  </div>
                  <section className="section">
                    <div className="section-head">
                      <h2>Client requests</h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setProjectId(project.id);
                          navigate("timeline");
                        }}
                      >
                        Project timeline <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="panel">
                      {w.requests.filter((r) => r.projectId === project.id).length ? (
                        w.requests.filter((r) => r.projectId === project.id).map(requestRow)
                      ) : (
                        <Empty title="No requests" />
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <label className="search-field">
                    <Search size={17} />
                    <input aria-label="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
                  </label>
                  <div className="project-grid all-projects">{filteredProjects.map(projectCard)}</div>
                </>
              )}
            </>
          )}
          {view === "requests" && (
            <>
              <div className="page-heading">
                <div>
                  {selectedRequest && (
                    <button className="text-button back-button" onClick={() => setRequestId(undefined)}>
                      <ChevronLeft size={16} />
                      All requests
                    </button>
                  )}
                  <h1>{selectedRequest ? "Request review" : "Client requests"}</h1>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setMessage("");
                    setRequestModal(true);
                  }}
                >
                  <Plus size={17} />
                  New request
                </button>
              </div>
              {selectedRequest ? (
                <div className="review-layout">
                  <div>
                    <div className="panel message-panel">
                      <span className="eyebrow">Client message</span>
                      <blockquote>“{selectedRequest.message}”</blockquote>
                    </div>
                    <div className="section-head review-title">
                      <h2>Scope review</h2>
                      <span className={`badge ${selectedRequest.engine === "demo" ? "amber" : "green"}`}>
                        {selectedRequest.engine === "demo" ? "Sample rules · not AI" : "Analysed with Groq"}
                      </span>
                    </div>
                    {selectedRequest.items.map((item, i) => (
                      <div className="panel analysis-card" key={i}>
                        <div className="section-head">
                          <h3>{item.title}</h3>
                          <span
                            className={`badge ${item.classification === "included" ? "green" : item.classification === "additional" ? "lavender" : "amber"}`}
                          >
                            {labels[item.classification]}
                          </span>
                        </div>
                        <p className="muted">{item.reason}</p>
                        {item.evidence && (
                          <div className="evidence">
                            <span>From the scope</span>
                            <p>“{item.evidence}”</p>
                          </div>
                        )}
                        {item.question && (
                          <div className="clarification">
                            <p>{item.question}</p>
                            <button className="text-button" onClick={() => copy(item.question)}>
                              <Copy size={14} />
                              Copy question
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <aside>
                    <div className="panel next-step-card">
                      <h3>Next step</h3>
                      {selectedRequest.items.every((i) => i.classification === "included") && <p className="muted">No proposal needed.</p>}
                      {selectedRequest.items.some((i) => i.classification !== "included") && (
                        <button
                          className="button primary full"
                          disabled={busy}
                          onClick={() => {
                            const existing = w.proposals.find((p) => p.requestId === selectedRequest.id && p.status !== "declined");
                            if (existing && !["draft", "revision_requested"].includes(existing.status)) {
                              navigate("proposals");
                              return;
                            }
                            setEditing({ request: selectedRequest, proposal: existing });
                          }}
                        >
                          Prepare proposal
                        </button>
                      )}
                    </div>
                    <details className="panel scope-details">
                      <summary>
                        Scope <ChevronDown size={16} />
                      </summary>
                      <p className="muted small">{project.scope}</p>
                    </details>
                  </aside>
                </div>
              ) : (
                <div className="panel">
                  {w.requests.length ? (
                    w.requests.map(requestRow)
                  ) : (
                    <Empty
                      title="No requests"
                      action={
                        <button className="button primary" onClick={() => setRequestModal(true)}>
                          Review a request
                        </button>
                      }
                    />
                  )}
                </div>
              )}
            </>
          )}
          {view === "proposals" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Proposals</h1>
                </div>
                <button className="button secondary" onClick={() => run(load)} disabled={busy}>
                  {busy ? <Spinner /> : <Clock3 size={16} />}Refresh
                </button>
              </div>
              {w.proposals.length ? (
                <div className="proposal-list">
                  {w.proposals.map((p) => (
                    <div className="panel proposal-card" key={p.id}>
                      <div className="section-head">
                        <div>
                          <span className="eyebrow">
                            {w.projects.find((project) => project.id === p.projectId)?.name} · v{p.version}
                          </span>
                          <h2>{p.title}</h2>
                        </div>
                        <Status value={p.status} />
                      </div>
                      <p className="muted">{p.description}</p>
                      <div className="proposal-facts">
                        <strong>
                          {money(p.totalCents)} <small>USD</small>
                        </strong>
                        <span>
                          <Clock3 size={15} />
                          {p.hours} {p.hours === 1 ? "hour" : "hours"}
                        </span>
                        <span>
                          <CalendarDays size={15} />
                          Delivery {dateLabel(p.deadline)}
                        </span>
                        <span className="badge neutral">{p.mode === "demo" ? "Demo payment" : "PayPal Sandbox"}</span>
                      </div>
                      {p.invoiceError && (
                        <div className="form-error" role="alert">
                          {p.invoiceError}
                        </div>
                      )}
                      {p.clientNote && (
                        <div className="notice">
                          <MessageSquare size={17} />
                          <span>{p.clientNote}</span>
                        </div>
                      )}
                      {p.scheduleReview && (
                        <div className="notice">
                          <span>Paid. The schedule changed after this was priced, so it is not on the timeline yet.</span>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await action({ action: "scheduleReviewed", id: p.id });
                                await load();
                                setToast("Added to the end of the timeline.");
                              })
                            }
                          >
                            Add to end of timeline
                          </button>
                        </div>
                      )}
                      {proposalButtons(p)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel">
                  <Empty title="No proposals" />
                </div>
              )}
            </>
          )}
          {view === "timeline" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Timeline</h1>
                </div>
                <select
                  aria-label="Timeline project"
                  value={project.id}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="project-select"
                >
                  {w.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="panel timeline-panel">
                <div className="section-head">
                  <h2>{project.name}</h2>
                  <span className="muted small">Delivery {dateLabel(project.deadline)}</span>
                </div>
                <Timeline
                  project={project}
                  locked={w.proposals
                    .filter((p) => p.projectId === project.id && p.status === "approved")
                    .flatMap((p) => lockedTasks(project, p))}
                />
              </div>
            </>
          )}
          {view === "settings" && (
            <Connections
              integrations={integrations}
              onSignOut={() =>
                run(async () => {
                  await fetch("/api/auth", { method: "DELETE" });
                  await load();
                })
              }
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      <Modal open={projectModal} onOpenChange={setProjectModal} title="New project">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              const result = await action({
                action: "createProject",
                name: f.get("name"),
                client: f.get("client"),
                email: f.get("email"),
                scope: f.get("scope"),
                rate: Number(f.get("rate")),
                budget: Number(f.get("budget")),
                deadline: f.get("deadline"),
              });
              await load();
              setProjectModal(false);
              openProject(result.result);
              setToast("Project created.");
            });
          }}
        >
          <div className="form-grid">
            <label className="field span-two">
              <span>Project name</span>
              <input name="name" minLength={3} maxLength={100} required />
            </label>
            <label className="field">
              <span>Client name</span>
              <input name="client" minLength={2} required />
            </label>
            <label className="field">
              <span>Client email</span>
              <input name="email" type="email" required />
            </label>
            <label className="field span-two">
              <span>Scope</span>
              <textarea name="scope" rows={5} minLength={40} maxLength={24000} required />
            </label>
            <label className="field">
              <span>Budget (USD)</span>
              <input name="budget" type="number" min="1" step="0.01" required />
            </label>
            <label className="field">
              <span>Hourly rate (USD)</span>
              <input name="rate" type="number" min="1" step="0.01" defaultValue="50" required />
            </label>
            <label className="field span-two">
              <span>Deadline</span>
              <input name="deadline" type="date" min={new Date().toISOString().slice(0, 10)} required />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button className="button secondary" type="button" onClick={() => setProjectModal(false)}>
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? <Spinner /> : <Plus size={16} />}Create project
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={requestModal} onOpenChange={setRequestModal} title="Review a request">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const result = await api("/api/analyze", { projectId: project.id, message });
              await load();
              setRequestModal(false);
              openRequest(result.request);
            });
          }}
        >
          <label className="field">
            <span>Project</span>
            <select value={project.id} onChange={(e) => setProjectId(e.target.value)}>
              {w.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Client message</span>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              minLength={10}
              maxLength={16000}
              required
            />
          </label>
          <div className="sample-buttons">
            <span className="muted small">Examples:</span>
            {[
              { name: "Extra feature", text: "Could we add a page where customers can book a cake tasting?" },
              { name: "Included revision", text: "For our first visual revision, can we change the heading colour to green?" },
              { name: "Needs clarity", text: "Can we make the website feel a bit more premium?" },
            ].map((sample) => (
              <button
                type="button"
                key={sample.name}
                onClick={() => {
                  setProjectId("p-bloom");
                  setMessage(sample.text);
                }}
              >
                {sample.name}
              </button>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button className="button secondary" type="button" onClick={() => setRequestModal(false)}>
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? (
                <>
                  <Spinner />
                  Reviewing…
                </>
              ) : (
                "Review"
              )}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(undefined)} title="Proposal">
        {editing && (
          <ProposalForm
            key={`${editing.request.id}-${editing.proposal?.version}`}
            request={editing.request}
            proposal={editing.proposal}
            project={w.projects.find((p) => p.id === editing.request.projectId)!}
            busy={busy}
            error={error}
            onSave={(values) =>
              run(async () => {
                await action({ action: "saveProposal", requestId: editing.request.id, ...values });
                await load();
                setEditing(undefined);
                navigate("proposals");
                setToast("Proposal saved.");
              })
            }
          />
        )}
      </Modal>
      <Modal open={Boolean(share)} onOpenChange={(open) => !open && setShare(undefined)} title="Share proposal">
        {share && (
          <>
            <div className="share-preview">
              <FileCheck2 size={22} />
              <div>
                <strong>{share.title}</strong>
                <span className="muted small">
                  {money(share.totalCents)} · Proposal v{share.version}
                </span>
              </div>
            </div>
            <label className="field">
              <span>Link</span>
              <input
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/client/${share.token}`}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="form-footer">
              <button className="button secondary" onClick={() => copy(`${window.location.origin}/client/${share.token}`)}>
                <Copy size={16} />
                Copy link
              </button>
              <a className="button primary" href={`/client/${share.token}`} target="_blank" rel="noreferrer">
                Open <ExternalLink size={16} />
              </a>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
