import { opportunities } from "@/lib/demo-data";

function cell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET() {
  const header = ["Title","Industry","Location","Asking price","Revenue","Cash flow","EBITDA","Source","Source URL"];
  const rows = opportunities.map((item) => [item.title,item.industry,item.location,item.price,item.revenue,item.cashFlow,item.ebitda,item.source,item.sourceUrl]);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="crestview-opportunities.csv"' } });
}
