import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { workbookBucket, workbookObject } from "@/lib/private-workbook";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Billing access is unavailable." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: entitlement, error: entitlementError } = await supabase
    .from("billing_entitlements")
    .select("active,expires_at")
    .eq("user_id", user.id)
    .eq("product_code", "crestview_pro")
    .maybeSingle();

  if (entitlementError) {
    return Response.json({ error: "Billing access is temporarily unavailable. Please try again." }, {
      status: 503,
      headers: { "cache-control": "private, no-store" },
    });
  }

  const hasPro = Boolean(
    entitlement?.active &&
    (!entitlement.expires_at || new Date(entitlement.expires_at) > new Date()),
  );
  if (!hasPro) return Response.json({ error: "Crestview Pro is required." }, { status: 403 });

  // Never expose a public or signed storage URL. Recheck Pro on each download.
  let file: Blob | null = null;
  try {
    const result = await createSupabaseAdminClient().storage.from(workbookBucket).download(workbookObject);
    if (!result.error) file = result.data;
  } catch {
    // Fail closed without exposing storage credentials or internal errors.
  }
  if (!file) return Response.json({ error: "The workbook is temporarily unavailable. Please try again." }, {
    status: 503, headers: { "cache-control": "private, no-store" },
  });
  return new Response(file, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="Crestview_Financial_Due_Diligence_Calculator.xlsx"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
