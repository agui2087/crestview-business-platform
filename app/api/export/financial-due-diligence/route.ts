import { financialDueDiligenceWorkbookBase64 } from "@/lib/financial-due-diligence-workbook";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Billing access is unavailable." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: entitlement } = await supabase
    .from("billing_entitlements")
    .select("active,expires_at")
    .eq("user_id", user.id)
    .eq("product_code", "crestview_pro")
    .maybeSingle();

  const hasPro = Boolean(
    entitlement?.active &&
    (!entitlement.expires_at || new Date(entitlement.expires_at) > new Date()),
  );
  if (!hasPro) return Response.json({ error: "Crestview Pro is required." }, { status: 403 });

  const binary = atob(financialDueDiligenceWorkbookBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="Crestview_Financial_Due_Diligence_Calculator.xlsx"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
