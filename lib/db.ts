import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type IncidentStatus =
  | "OPEN"
  | "UNDERSTANDING"
  | "SEARCHING"
  | "OPTIONS_FOUND"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "RESOLVED"
  | "CANCELLED";

export interface Incident {
  id: string;
  user_id: string;
  status: IncidentStatus;
  type: string | null;
  context: Record<string, unknown>;
  selected_offer: unknown | null;
}

export async function getOrCreateIncident(userId: string): Promise<Incident> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("relay_incidents")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as Incident;

  const { data: created, error } = await supabase
    .from("relay_incidents")
    .insert({ user_id: userId, status: "OPEN", context: {} })
    .select()
    .single();

  if (error) throw error;
  return created as Incident;
}

export async function updateIncident(id: string, patch: Partial<Incident>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("relay_incidents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Incident;
}

export async function addMessage(
  incidentId: string,
  role: "user" | "assistant" | "system",
  content: string
) {
  const supabase = getSupabase();
  await supabase.from("relay_messages").insert({
    incident_id: incidentId,
    role,
    content,
  });
}

export async function getRecentMessages(incidentId: string, limit = 12) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("relay_messages")
    .select("role, content")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).reverse() as { role: string; content: string }[];
}
