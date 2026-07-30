import "server-only";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type MarketplaceListing = {
  id: string;
  broker_id: string;
  title: string;
  summary: string;
  industry: string;
  city: string;
  state_code: string;
  asking_price: number | null;
  annual_revenue: number | null;
  cash_flow: number | null;
  financing_available: boolean;
  public_highlights: string[];
  status: string;
  updated_at: string;
  quality_score?: number;
  nda_automatic?: boolean;
};

export type DealInquiry = {
  id: string;
  listing_id: string;
  buyer_id: string;
  broker_id: string;
  subject: string;
  initial_message: string;
  status: string;
  updated_at: string;
  requested_items?: string[];
  acquisition_experience?: string | null;
  funding_readiness?: string | null;
  financial_access_status?: string;
  financial_request_message?: string | null;
  financial_request_timeline?: string | null;
  financial_request_capital?: string | null;
  financial_requested_at?: string | null;
  marketplace_listings?: { title: string; city: string; state_code: string } | null;
};

export const demoMarketplaceListings: MarketplaceListing[] = [
  {
    id: "demo-portland-hvac",
    broker_id: "demo-broker",
    title: "Established Commercial HVAC Services",
    summary: "Recurring commercial maintenance accounts, experienced field team, and a strong Portland-area reputation.",
    industry: "Commercial Services",
    city: "Portland",
    state_code: "OR",
    asking_price: 1_450_000,
    annual_revenue: 2_180_000,
    cash_flow: 438_000,
    financing_available: true,
    public_highlights: ["Recurring service contracts", "Experienced management team", "Seller transition available"],
    status: "published",
    updated_at: "2026-07-28T12:00:00.000Z",
    nda_automatic: true,
  },
  {
    id: "demo-seattle-landscape",
    broker_id: "demo-broker",
    title: "Commercial Landscape Maintenance Company",
    summary: "Route-dense commercial accounts with a trained operations team and modern equipment fleet.",
    industry: "Home & Business Services",
    city: "Seattle",
    state_code: "WA",
    asking_price: 975_000,
    annual_revenue: 1_630_000,
    cash_flow: 312_000,
    financing_available: false,
    public_highlights: ["Dense recurring routes", "Low customer concentration", "Fleet included"],
    status: "published",
    updated_at: "2026-07-27T12:00:00.000Z",
    nda_automatic: true,
  },
  {
    id: "demo-sf-b2b",
    broker_id: "demo-broker",
    title: "Profitable B2B Compliance Consultancy",
    summary: "Specialized advisory practice with repeat clients, documented delivery processes, and remote-ready operations.",
    industry: "Professional Services",
    city: "San Francisco",
    state_code: "CA",
    asking_price: 2_200_000,
    annual_revenue: 2_870_000,
    cash_flow: 690_000,
    financing_available: true,
    public_highlights: ["Repeat enterprise clients", "Remote delivery team", "Documented operating playbook"],
    status: "published",
    updated_at: "2026-07-26T12:00:00.000Z",
    nda_automatic: true,
  },
];

export const demoInquiries: DealInquiry[] = [
  {
    id: "demo-inquiry",
    listing_id: demoMarketplaceListings[0].id,
    buyer_id: "demo-buyer",
    broker_id: "demo-broker",
    subject: "Information request — Established Commercial HVAC Services",
    initial_message: "I would like to review the NDA, financial statements, and confidential information memorandum.",
    status: "nda_sent",
    updated_at: "2026-07-29T10:30:00.000Z",
    requested_items: [],
    acquisition_experience: "first-time",
    funding_readiness: "exploring",
    financial_access_status: "not_requested",
    financial_request_message: null,
    financial_request_timeline: null,
    financial_request_capital: null,
    marketplace_listings: { title: demoMarketplaceListings[0].title, city: "Portland", state_code: "OR" },
  },
];

export async function getMarketplaceListings() {
  if (!isSupabaseConfigured()) return demoMarketplaceListings;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select("id,broker_id,title,summary,industry,city,state_code,asking_price,annual_revenue,cash_flow,financing_available,public_highlights,status,updated_at,quality_score,listing_nda_templates(auto_send)")
      .eq("status", "published")
      .order("updated_at", { ascending: false });
    if (error || !data?.length) return demoMarketplaceListings;
    return data.map((listing) => ({
      ...listing,
      nda_automatic: Array.isArray(listing.listing_nda_templates)
        ? Boolean(listing.listing_nda_templates[0]?.auto_send)
        : Boolean((listing.listing_nda_templates as { auto_send?: boolean } | null)?.auto_send),
    })) as MarketplaceListing[];
  } catch {
    return demoMarketplaceListings;
  }
}

export async function getMyListings(userId?: string) {
  if (!userId || !isSupabaseConfigured()) return demoMarketplaceListings.slice(0, 1);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select("id,broker_id,title,summary,industry,city,state_code,asking_price,annual_revenue,cash_flow,financing_available,public_highlights,status,updated_at,quality_score,listing_nda_templates(auto_send)")
      .eq("broker_id", userId)
      .order("updated_at", { ascending: false });
    if (error || !data?.length) return demoMarketplaceListings.slice(0, 1);
    return data.map((listing) => ({
      ...listing,
      nda_automatic: Array.isArray(listing.listing_nda_templates)
        ? Boolean(listing.listing_nda_templates[0]?.auto_send)
        : Boolean((listing.listing_nda_templates as { auto_send?: boolean } | null)?.auto_send),
    })) as MarketplaceListing[];
  } catch {
    return demoMarketplaceListings.slice(0, 1);
  }
}

export async function getMyInquiries(userId?: string) {
  if (!userId || !isSupabaseConfigured()) return demoInquiries;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("deal_inquiries")
      .select("id,listing_id,buyer_id,broker_id,subject,initial_message,status,updated_at,requested_items,acquisition_experience,funding_readiness,financial_access_status,financial_request_message,financial_request_timeline,financial_request_capital,financial_requested_at,marketplace_listings(title,city,state_code)")
      .or(`buyer_id.eq.${userId},broker_id.eq.${userId}`)
      .order("updated_at", { ascending: false });
    if (error || !data?.length) return demoInquiries;
    return data as unknown as DealInquiry[];
  } catch {
    return demoInquiries;
  }
}

export function formatMoney(value: number | null) {
  if (!value) return "Available after inquiry";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export const dealStages = [
  ["submitted", "Inquiry sent"],
  ["screening", "Broker screening"],
  ["approved", "Buyer approved"],
  ["nda_sent", "NDA sent"],
  ["nda_signed", "NDA signed"],
  ["document_review", "Document review"],
  ["meeting", "Management meeting"],
  ["offer", "Offer / LOI"],
  ["closed", "Closed"],
] as const;
