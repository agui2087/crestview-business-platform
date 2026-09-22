export const inquiryFilters = ["all", "questions", "needs_review", "nda", "documents", "offer", "finished"] as const;
export type InquiryFilter = typeof inquiryFilters[number];
type Inquiry = { id: string; status: string; requested_items?: string[]; financial_access_status?: string | null; subject: string; marketplace_listings?: { title: string } | null };
export function normalizeInquiryFilter(value: unknown): InquiryFilter {
  return typeof value === "string" && inquiryFilters.includes(value as InquiryFilter) ? value as InquiryFilter : "all";
}
export function filterInquiryPipeline<T extends Inquiry>(items: T[], filter: InquiryFilter, search: string): T[] {
  const term = search.trim().slice(0, 150).toLowerCase();
  return items.filter(item => {
    const finished = ["declined", "closed"].includes(item.status);
    const matches = filter === "all" ||
      (filter === "questions" && !finished && item.requested_items?.includes("Public listing question")) ||
      (filter === "needs_review" && !finished && (["submitted", "nda_signed", "offer"].includes(item.status) || item.financial_access_status === "requested")) ||
      (filter === "nda" && item.status === "nda_sent") ||
      (filter === "documents" && !finished && (["nda_signed", "document_review", "meeting"].includes(item.status) || item.financial_access_status === "approved")) ||
      (filter === "offer" && item.status === "offer") ||
      (filter === "finished" && finished);
    return matches && (!term || `${item.subject} ${item.marketplace_listings?.title ?? ""}`.toLowerCase().includes(term));
  });
}
