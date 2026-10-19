import { ONBOARDING_TEMPLATE, MONTHLY_TEMPLATE, monthLabel } from "./os";
import { addDaysISO, toWorkday } from "./format";

type NewTask = {
  client_id: string;
  title: string;
  kind: "onboarding" | "mensual";
  group_label: string;
  period: string | null;
  due_date: string;
  assignee_id: string | null;
  sort: number;
};

/** Las 7 tareas de onboarding a partir de la fecha de inicio (días laborables). */
export function onboardingTasks(clientId: string, startDate: string, assigneeId: string | null): NewTask[] {
  return ONBOARDING_TEMPLATE.map(([days, title], i) => ({
    client_id: clientId,
    title,
    kind: "onboarding",
    group_label: "Onboarding",
    period: null,
    due_date: toWorkday(addDaysISO(startDate, days), 1),
    assignee_id: assigneeId,
    sort: i,
  }));
}

/** Las 5 tareas del ciclo mensual de un periodo YYYY-MM. */
export function monthlyTasks(clientId: string, period: string, assigneeId: string | null): NewTask[] {
  const label = monthLabel(period);
  return MONTHLY_TEMPLATE.map(([day, title, backwards], i) => ({
    client_id: clientId,
    title,
    kind: "mensual",
    group_label: `Ciclo de ${label}`,
    period,
    due_date: toWorkday(`${period}-${String(day).padStart(2, "0")}`, backwards ? -1 : 1),
    assignee_id: assigneeId,
    sort: i,
  }));
}
