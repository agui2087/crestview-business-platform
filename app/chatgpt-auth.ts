import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
  source: "chatgpt" | "local" | "supabase";
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  if (isStandaloneHost(requestHeaders.get("host"))) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;
      const fullName =
        typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : null;
      return {
        displayName: fullName ?? user.email,
        email: user.email,
        fullName,
        source: "supabase",
      };
    }
    const localCookie = (await cookies()).get("crestview_local_user")?.value;
    if (!localCookie) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(localCookie)) as { email?: string; fullName?: string };
      if (!parsed.email || !parsed.fullName) return null;
      return {
        displayName: parsed.fullName,
        email: parsed.email,
        fullName: parsed.fullName,
        source: "local",
      };
    } catch {
      return null;
    }
  }
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return { displayName: fullName ?? email, email, fullName, source: "chatgpt" };
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(await chatGPTSignInHref(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export async function chatGPTSignInHref(returnTo: string): Promise<string> {
  const requestHeaders = await headers();
  const isStandalone = isStandaloneHost(requestHeaders.get("host"));
  const path = chatGPTSignInPath(returnTo);
  if (!isStandalone) return path;
  const locale = safeRelativeReturnPath(returnTo).split("/")[1] === "es" ? "es" : "en";
  return `/${locale}/sign-in?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export async function isStandaloneRequest() {
  return isStandaloneHost((await headers()).get("host"));
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  return `/signout-with-chatgpt?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isStandaloneHost(host: string | null) {
  const normalized = host?.toLowerCase() ?? "";
  return !normalized.endsWith(".chatgpt.site");
}
