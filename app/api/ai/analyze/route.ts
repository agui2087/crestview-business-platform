// Hosted analysis is retired. Private jobs never fall back to a hosted AI API.
export async function POST() {
  return Response.json({error:'Use private document analysis from your document vault when available.'},{status:410,headers:{'Cache-Control':'private, no-store'}});
}
