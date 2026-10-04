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
