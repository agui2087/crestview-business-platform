import { getChatGPTUser } from "@/app/chatgpt-auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ documents: [], error: "Online document storage is being connected." }, { status: 503 });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "That file type is not supported." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });
  return Response.json({ error: "Online document storage is being connected." }, { status: 503 });
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ error: "Online document storage is being connected." }, { status: 503 });
}
