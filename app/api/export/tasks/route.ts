import { createSupabaseServerClient } from "@/lib/supabase/server";

const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized",{status:401});
  const { data } = await supabase.from("deal_tasks").select("title,opportunity_key,due_date,priority,status").eq("user_id",user.id).order("due_date");
  const header = ["title","opportunity_key","due_date","priority","status"];
  const rows = (data ?? []).map((item) => header.map((key) => item[key as keyof typeof item]));
  return new Response([header,...rows].map((row)=>row.map(cell).join(",")).join("\n"),{headers:{"content-type":"text/csv","content-disposition":'attachment; filename="crestview-tasks.csv"'}});
}
