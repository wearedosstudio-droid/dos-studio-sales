import type { Priority, Status } from "./constants";

export type Company = {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  contact_role: string | null;
  recommended_service: string | null;
  problem: string | null;
  opportunity: string | null;
  priority: Priority;
  potential_value: number | null;
  status: Status;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  follow_up_note: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  company_id: string;
  body: string;
  author_email: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  email_mode: "evento" | "resumen" | "ninguno";
};

export type Client = {
  id: string;
  company_id: string | null;
  name: string;
  legal_name: string | null;
  nif: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  billing_email: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  service: string | null;
  phase: string;
  owner_id: string | null;
  reviewer_id: string | null;
  start_date: string;
  monthly_fee: number | null;
  min_months: number | null;
  payment_method: string | null;
  payment_days: number | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  kind: string;
  group_label: string | null;
  period: string | null;
  due_date: string;
  assignee_id: string | null;
  status: "pendiente" | "hecha";
  completed_at: string | null;
  completed_by: string | null;
  sort: number;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  client_id: string;
  folder: string;
  name: string;
  kind: "archivo" | "enlace";
  storage_path: string | null;
  url: string | null;
  mime: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  client_id: string;
  status: "borrador" | "emitida" | "cobrada" | "anulada";
  number: string | null;
  issue_date: string;
  due_date: string;
  payment_method: string;
  payment_note: string | null;
  period: string | null;
  notes: string | null;
  source: string;
  client_name: string | null;
  client_legal_name: string | null;
  client_nif: string | null;
  client_address: string | null;
  issuer: Settings | null;
  vat_rate: number;
  irpf_rate: number;
  subtotal: number;
  vat_amount: number;
  irpf_amount: number;
  total: number;
  paid_at: string | null;
  paid_amount: number | null;
  created_at: string;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort: number;
};

export type Settings = {
  legal_name: string | null;
  trade_name: string | null;
  nif: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  iban: string | null;
  invoice_series: string;
  default_vat_rate: number;
  default_irpf_rate: number;
  default_payment_days: number;
  default_payment_method: string;
  invoice_footer: string | null;
};

export type ActivityRow = {
  id: number;
  at: string;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: "insert" | "update" | "delete";
  client_id: string | null;
  label: string | null;
  changes: Record<string, [unknown, unknown]> | null;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};
