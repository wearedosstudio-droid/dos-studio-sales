import Link from "next/link";
import type { Profile, Task } from "@/lib/types";
import { followUpLabel, todayISO } from "@/lib/format";
import { personName } from "@/lib/team";
import { deleteTask, toggleTask, updateTask } from "@/app/(app)/tasks/actions";
import { Avatar } from "./OS";
import { ConfirmButton } from "./ConfirmButton";

/** Una tarea: casilla para completarla, cliente, vencimiento, responsable y edición rápida. */
export function TaskItem({
  task,
  team,
  me,
  clientName,
  showClient = true,
}: {
  task: Task;
  team: Record<string, Profile>;
  me: string;
  clientName?: string | null;
  showClient?: boolean;
}) {
  const today = todayISO();
  const done = task.status === "hecha";
  const late = !done && task.due_date < today;
  const isToday = !done && task.due_date === today;

  return (
    <li className="group py-3">
      <div className="flex items-start gap-3">
        <form action={toggleTask.bind(null, task.id)}>
          <button
            type="submit"
            aria-label={done ? `Reabrir: ${task.title}` : `Completar: ${task.title}`}
            className={`mt-0.5 grid h-5 w-5 place-content-center rounded-md border-2 transition ${
              done ? "border-violet bg-violet text-white" : "border-graphite/50 hover:border-violet"
            }`}
          >
            {done && (
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </form>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${done ? "text-graphite line-through" : ""}`}>{task.title}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-graphite">
            {showClient && task.client_id && clientName && (
              <Link href={`/clients/${task.client_id}`} className="text-violet hover:underline">
                {clientName}
              </Link>
            )}
            {showClient && !task.client_id && <span>Interna</span>}
            {task.group_label && <span>{task.group_label}</span>}
            {done && task.completed_by && <span>Hecha por {personName(team, task.completed_by, me)}</span>}
          </p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
            done ? "bg-emerald-50 text-emerald-700" : late ? "bg-red-50 text-red-700" : isToday ? "bg-violet-soft text-violet" : "bg-canvas text-graphite"
          }`}
        >
          {done ? "Hecha" : followUpLabel(task.due_date, today)}
        </span>
        <Avatar team={team} id={task.assignee_id} me={me} />
      </div>

      {!done && (
        <details className="ml-8 mt-1">
          <summary className="cursor-pointer text-[11px] text-graphite hover:text-violet">Editar</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <form action={updateTask.bind(null, task.id)} className="flex flex-wrap items-end gap-2">
              <input name="title" defaultValue={task.title} aria-label="Título" className="input w-64 max-w-full py-1.5" />
              <input name="due_date" type="date" defaultValue={task.due_date} aria-label="Vence" className="input w-auto py-1.5" />
              <select name="assignee_id" defaultValue={task.assignee_id ?? ""} aria-label="Responsable" className="input w-auto py-1.5">
                <option value="">Sin asignar</option>
                {Object.values(team).map((p) => (
                  <option key={p.id} value={p.id}>
                    {personName(team, p.id, me)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary py-1.5">
                Guardar
              </button>
            </form>
            <form action={deleteTask.bind(null, task.id)}>
              <ConfirmButton message="¿Borrar esta tarea?" className="btn py-1.5 text-red-600 hover:bg-red-50">
                Borrar
              </ConfirmButton>
            </form>
          </div>
        </details>
      )}
    </li>
  );
}
