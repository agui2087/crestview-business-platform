import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createOpportunityList } from "../opportunities/actions";

type SavedList = {
  id: string;
  name: string;
  description: string | null;
  opportunity_list_items: Array<{ opportunity_key: string }>;
};

export default async function ListsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let lists: SavedList[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("opportunity_lists")
        .select("id,name,description,opportunity_list_items(opportunity_key)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      lists = (data ?? []) as SavedList[];
    }
  }
  const es = locale === "es";
  return <PlatformShell locale={locale} active="lists"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Organización" : "Research organization"} title={es ? "Listas guardadas" : "Saved lists"} body={es ? "Agrupa oportunidades por estrategia, mercado o prioridad." : "Group opportunities by strategy, market, or priority."} />
    <form className="task-create list-create" action={createOpportunityList}>
      <input type="hidden" name="locale" value={locale}/>
      <label>{es ? "Nombre de la lista" : "List name"}<input required name="name" placeholder={es ? "Ejemplo: Portland servicios" : "Example: Portland services"}/></label>
      <label>{es ? "Descripción" : "Description"}<input name="description" placeholder={es ? "Qué pertenece en esta lista" : "What belongs in this list"}/></label>
      <button className="button button--primary">{es ? "Crear lista" : "Create list"}</button>
    </form>
    <div className="saved-list-grid">
      {lists.map((list) => <section className="panel saved-list-card" key={list.id}>
        <div className="panel__header"><div><span>{list.opportunity_list_items.length} {es ? "oportunidades" : "opportunities"}</span><h2>{list.name}</h2></div></div>
        {list.description && <p>{list.description}</p>}
        {list.opportunity_list_items.map(({ opportunity_key }) => {
          const item = getOpportunity(opportunity_key);
          return item ? <Link className="saved-list-item" href={`/${locale}/dashboard/opportunities/${item.id}`} key={item.id}><strong>{item.title}</strong><span>{item.location} · {item.price}</span></Link> : null;
        })}
        {!list.opportunity_list_items.length && <p className="muted">{es ? "Agrega negocios desde una página de oportunidad." : "Add businesses from an opportunity page."}</p>}
      </section>)}
      {!lists.length && <div className="empty-state"><h2>{es ? "Crea tu primera lista" : "Create your first list"}</h2><p>{es ? "Úsala para mantener juntas oportunidades similares." : "Use lists to keep related opportunities together."}</p></div>}
    </div>
  </div></PlatformShell>;
}
