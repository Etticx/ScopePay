"use client";
import { useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/domain";
import type { Project, Task } from "@/lib/types";
import { Spinner } from "./ui";

export default function Timeline({ project, locked = [] }: { project: Pick<Project, "tasks" | "deadline">; locked?: Task[] }) {
  const tasks = [...project.tasks, ...locked];
  const end = tasks.map(t => addDays(t.start, t.days)).concat(project.deadline).sort().at(-1)!;
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
      const start = tasks.map(t => t.start).sort()[0] || project.deadline;
      chart = new Gantt({
        appendTo: target.current, height: 110 + tasks.length * 54, readOnly: true,
        // forceFit stretches ticks to the width; zoomToFit stops at the preset's minimum tick and leaves locked work off-screen.
        rowHeight: 54, barMargin: 15, viewPreset: "weekAndDayLetter", forceFit: true,
        startDate: addDays(start, -1), endDate: addDays(end, 3),
        columns: [{ type: "name", text: "Tasks", width: target.current.clientWidth < 600 ? 130 : 250 }],
        features: { taskEdit: false, taskMenu: false, cellEdit: false, projectLines: false },
        project: {
          startDate: start,
          calendar: "all-days",
          calendars: [{ id: "all-days", name: "Calendar days", unspecifiedTimeIsWorking: true }],
          tasks: tasks.map(t => ({ id: t.id, name: t.name, startDate: t.start, duration: t.days, durationUnit: "day", percentDone: t.progress, manuallyScheduled: true, // Brand colours, kept in step with the legend swatches in globals.css.
            eventColor: t.locked ? "#b9bfb6" : t.days === 0 ? "#c98a3d" : t.proposalId ? "#34664c" : "#7d9cb8", iconCls: t.locked ? "fa fa-lock" : undefined })),
          dependencies: tasks.filter(t => t.dependency).map(t => ({ fromTask: t.dependency, toTask: t.id, type: 2 })),
        },
      });
      setLoading(false);
    }).catch(() => { if (!disposed) { setError("The Bryntum timeline could not load. Check the trial installation and refresh."); setLoading(false); } });
    return () => { disposed = true; chart?.destroy(); };
  }, [JSON.stringify(tasks), project.deadline]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="timeline-wrap">{loading && <div className="loading-inline"><Spinner /> Loading…</div>}{error && <p role="alert" className="form-error">{error}</p>}<div ref={target} /><div className="timeline-caption"><span><span className="legend-line" /> Agreed tasks</span><span><span className="legend-line green-line" /> Paid</span>{locked.length > 0 && <><span><span className="legend-line amber-line" /> Payment</span><span><span className="legend-line gray-line" /> Locked until paid</span></>}</div></div>;
}
