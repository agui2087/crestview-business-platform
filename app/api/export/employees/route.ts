import { createSupabaseServerClient } from "@/lib/supabase/server";
import { employeeCsv } from "@/lib/workforce-export";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized",{status:401});
  const owner=new URL(request.url).searchParams.get("owner")||user.id;
  const {data:role,error:accessError}=await supabase.rpc("workforce_role",{p_owner:owner});
  if(accessError)return new Response("Unable to verify export access",{status:503});
  if(!["owner","hr"].includes(role))return new Response("Forbidden",{status:403});
  const { data,error,count } = await supabase.from("employees").select("full_name,email,position,department,manager_name,start_date,employment_status,preferred_locale",{count:"exact"}).eq("user_id",owner).is("archived_at",null).order("full_name").limit(500);
  if(error)return new Response("Employee export unavailable",{status:503});
  if((count??0)>500)return new Response("Export exceeds 500 employees. A paginated export is required; no partial file was generated.",{status:422});
  return new Response(employeeCsv(data??[]),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="crestview-employees.csv"',"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
