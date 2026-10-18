"use client";
import { useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/domain";
import type { Project } from "@/lib/types";
import { Spinner } from "./ui";

export default function Timeline({ project }: { project: Project }) {
  const target = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let chart: { destroy: () => void } | undefined;
    let disposed = false;
    setLoading(true); setError("");
    const assetRoot = "/vendor/bryntum";
    const styles = ["fontawesome/css/fontawesome.css", "fontawesome/css/solid.css", "gantt.css", "stockholm-light.css"];
    const stylesReady = styles.map(file => new Promise<void>((resolve, reject) => {
      if (!document.querySelector(`link[data-bryntum="${file}"]`)) {
        const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `${assetRoot}/${file}`; link.dataset.bryntum = file; link.onload = () => resolve(); link.onerror = () => reject(new Error("Timeline styles could not load")); document.head.appendChild(link);
      } else resolve();
    }));
    const moduleUrl = `${assetRoot}/gantt.module.js`;
    Promise.all([Promise.all(stylesReady), import(/* webpackIgnore: true */ moduleUrl)]).then(([, { Gantt }]) => {
      if (disposed || !target.current) return;
      const start = project.tasks.map(t => t.start).sort()[0] || project.deadline;
      chart = new Gantt({
        appendTo: target.current, height: 390, readOnly: true,
        rowHeight: 54, barMargin: 15, viewPreset: "weekAndDayLetter",
        startDate: addDays(start, -1), endDate: addDays(project.deadline, 3),
        columns: [{ type: "name", text: "Project tasks", width: 230 }],
        features: { taskEdit: false, taskMenu: false, cellEdit: false },
        project: {
          startDate: start,
          calendar: "all-days",
          calendars: [{ id: "all-days", name: "Calendar days", unspecifiedTimeIsWorking: true }],
          tasks: project.tasks.map(t => ({ id: t.id, name: t.name, startDate: t.start, duration: t.days, durationUnit: "day", percentDone: t.progress, manuallyScheduled: true, eventColor: t.proposalId ? "green" : "blue" })),
          dependencies: project.tasks.filter(t => t.dependency).map(t => ({ fromTask: t.dependency, toTask: t.id, type: 2 })),
        },
      });
      setLoading(false);
    }).catch(() => { if (!disposed) { setError("The Bryntum timeline could not load. Check the trial installation and refresh."); setLoading(false); } });
    return () => { disposed = true; chart?.destroy(); };
  }, [project]);
  return <div className="timeline-wrap">{loading && <div className="loading-inline"><Spinner /> Loading your timeline…</div>}{error && <p role="alert" className="form-error">{error}</p>}<div ref={target} /><div className="timeline-caption"><span><span className="legend-line" /> Agreed project tasks</span><span><span className="legend-line green-line" /> Paid additions</span><span className="muted">Bryntum Gantt · evaluation</span></div></div>;
}
