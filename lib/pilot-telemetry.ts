import "server-only";
import { reportOperationalEvent } from "@/lib/observability";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type PilotEvent = {
  userId: string | null;
  eventName: string;
  route: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function normalizePilotRoute(value: string) {
  const path = value.split(/[?#]/, 1)[0] || "/";
  return path.startsWith("/") ? path.slice(0, 200) : "/";
}

/** Pilot telemetry must never interrupt a participant's primary workflow. */
export async function recordPilotEvent(input: PilotEvent) {
  if (!input.userId || !isSupabaseConfigured()) return false;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("pilot_events").insert({
      user_id: input.userId,
      event_name: input.eventName,
      route: normalizePilotRoute(input.route),
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
    return true;
  } catch (error) {
    await reportOperationalEvent({
      event: "pilot.telemetry_failed",
      level: "warn",
      route: normalizePilotRoute(input.route),
      error,
    });
    return false;
  }
}
