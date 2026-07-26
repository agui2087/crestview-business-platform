import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  return new Response("Online document storage is being connected.", { status: 503 });
}
