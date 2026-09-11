import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { resolveOpportunities } from "@/lib/opportunity-resolver";
import { savedOpportunitiesCsv, type SavedExport } from "@/lib/customer-export";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
  if (!isSupabaseConfigured()) return Response.json({ error: "Export unavailable." }, { status: 503, headers });
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to export your saved opportunities." }, { status: 401, headers });
  const locale = new URL(request.url).searchParams.get('locale') === 'es' ? 'es' : 'en';
  try {
    const rows: SavedExport[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('saved_opportunities').select('opportunity_key,stage,next_action,notes,updated_at').eq('user_id', user.id).order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
      if (rows.length >= 10000) return Response.json({ error: "Export is too large. Contact support for a complete export." }, { status: 413, headers });
    }
    const titles = new Map<string, string>();
    for (let offset = 0; offset < rows.length; offset += 100) {
      const resolved = await resolveOpportunities(rows.slice(offset, offset + 100).map(row => row.opportunity_key), locale);
      for (const [key, value] of resolved) titles.set(key, value.title);
    }
    return new Response(savedOpportunitiesCsv(rows, titles, locale === 'es'), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="crestview-saved-opportunities.csv"' } });
  } catch {
    return Response.json({ error: "Your export could not be loaded. No partial export was generated." }, { status: 503, headers });
  }
}
