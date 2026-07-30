import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const preferred = (await cookies()).get("crestview_locale")?.value;
  redirect(preferred === "es" ? "/es" : "/en");
}
