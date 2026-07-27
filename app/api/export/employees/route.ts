import { createSupabaseServerClient } from "@/lib/supabase/server";

const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized",{status:401});
  const { data } = await supabase.from("employees").select("full_name,email,position,department,manager_name,start_date,employment_status,preferred_locale").eq("user_id",user.id).order("full_name");
  const header = ["full_name","email","position","department","manager_name","start_date","employment_status","preferred_locale"];
  const rows = (data ?? []).map((item) => header.map((key) => item[key as keyof typeof item]));
  return new Response([header,...rows].map((row)=>row.map(cell).join(",")).join("\n"),{headers:{"content-type":"text/csv","content-disposition":'attachment; filename="crestview-employees.csv"'}});
}
