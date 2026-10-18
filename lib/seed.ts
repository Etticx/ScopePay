import type { Workspace } from "./types";
import { addDays } from "./domain";

export function seed(): Workspace {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return {
    projects: [
      { id: "p-bloom", name: "Bloom Bakery website", client: "Sofia Chen", email: "sofia@example.com", initials: "BB", budget: 1200, rate: 50, deadline: addDays(today, 12), createdAt: now,
        scope: "Design and build a five-page bakery website: Home, Our Story, Menu, Gallery, and Contact. Includes a contact form, responsive layout, and two rounds of visual revisions. Online ordering, appointment booking, additional languages, and payment processing are explicitly excluded. Fixing defects in the agreed deliverables is included. Additional functionality requires a separately approved change proposal.",
        tasks: [{ id: "b1", name: "Discovery & page structure", start: addDays(today, -4), days: 2, progress: 100 }, { id: "b2", name: "Visual design", start: addDays(today, -2), days: 4, progress: 70, dependency: "b1" }, { id: "b3", name: "Website development", start: addDays(today, 2), days: 7, progress: 15, dependency: "b2" }, { id: "b4", name: "Review & handover", start: addDays(today, 9), days: 3, progress: 0, dependency: "b3" }] },
      { id: "p-studio", name: "Studio North portfolio", client: "Marcus Lee", email: "marcus@example.com", initials: "SN", budget: 850, rate: 60, deadline: addDays(today, 19), createdAt: now,
        scope: "A three-page photography portfolio with a gallery, biography, and contact page. One visual revision round. Includes responsive design and image optimization. E-commerce, booking systems, and extra pages are excluded.",
        tasks: [{ id: "s1", name: "Portfolio design", start: addDays(today, 3), days: 5, progress: 25 }, { id: "s2", name: "Build & launch", start: addDays(today, 8), days: 11, progress: 0, dependency: "s1" }] },
    ],
    requests: [{ id: "r-sample", projectId: "p-bloom", message: "Could we add a page where customers can book a cake tasting?", engine: "demo", createdAt: now,
      items: [{ title: "Cake tasting booking", classification: "additional", reason: "Appointment booking is explicitly excluded from the agreed website scope.", evidence: "Online ordering, appointment booking, additional languages, and payment processing are explicitly excluded.", question: "", hours: 4 }] }],
    proposals: [], events: [],
    activity: [{ id: "a1", text: "New request received · Bloom Bakery website", at: now, kind: "request" }, { id: "a2", text: "Project scope saved · Studio North portfolio", at: now, kind: "project" }, { id: "a3", text: "Welcome to your demo workspace", at: now, kind: "project" }],
  };
}
