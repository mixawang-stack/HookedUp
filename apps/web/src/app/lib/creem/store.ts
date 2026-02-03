import { getSupabaseAdmin } from "../../api/_lib/supabaseAdmin";

export type WebhookEventRecord = {
  provider: string;
  event_id: string;
  type: string;
  event_type: string;
  payload_json: Record<string, unknown>;
  received_at: string;
  process_status: "pending" | "success" | "failed" | "skipped";
  processed_at: string | null;
  error: string | null;
  attempts: number;
};

export const insertWebhookEvent = async (params: {
  provider: string;
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt?: string | null;
}) => {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("webhook_events").insert({
    provider: params.provider,
    event_id: params.eventId,
    type: params.type,
    event_type: params.type,
    payload_json: params.payload,
    received_at: params.createdAt ?? new Date().toISOString(),
    process_status: "pending",
    attempts: 0
  });
  return { error };
};

export const markWebhookEvent = async (
  eventId: string,
  status: WebhookEventRecord["process_status"],
  errorMessage?: string | null
) => {
  const supabase = getSupabaseAdmin();
  const payload = {
    process_status: status,
    processed_at: new Date().toISOString(),
    error: errorMessage ?? null
  };
  const { error } = await supabase
    .from("webhook_events")
    .update(payload)
    .eq("event_id", eventId);
  return { error };
};

export const incrementAttempts = async (eventId: string) => {
  const supabase = getSupabaseAdmin();
  const { data, error: fetchError } = await supabase
    .from("webhook_events")
    .select("attempts")
    .eq("event_id", eventId)
    .maybeSingle();
  if (fetchError) {
    return { error: fetchError };
  }
  const attempts = (data?.attempts ?? 0) + 1;
  const { error } = await supabase
    .from("webhook_events")
    .update({ attempts })
    .eq("event_id", eventId);
  return { error };
};

export const fetchPendingWebhookEvents = async (limit = 50) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("webhook_events")
    .select("provider,event_id,type,payload_json,received_at,attempts")
    .eq("provider", "creem")
    .in("process_status", ["pending", "failed"])
    .lt("attempts", 10)
    .order("received_at", { ascending: true })
    .limit(limit);
  return { data: data ?? [], error };
};
