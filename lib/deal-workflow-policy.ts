export const dealStatuses = [
  "submitted",
  "screening",
  "approved",
  "declined",
  "nda_sent",
  "nda_signed",
  "document_review",
  "meeting",
  "offer",
  "closed",
] as const;

export type DealStatus = (typeof dealStatuses)[number];

const brokerTransitions: Record<DealStatus, readonly DealStatus[]> = {
  submitted: ["screening", "approved", "declined"],
  screening: ["approved", "declined"],
  approved: ["declined"],
  declined: ["screening"],
  nda_sent: ["declined"],
  nda_signed: ["document_review", "meeting", "declined"],
  document_review: ["meeting", "offer", "declined"],
  meeting: ["document_review", "offer", "declined"],
  offer: ["document_review", "closed", "declined"],
  closed: [],
};

export function allowedBrokerTransitions(status: string): readonly DealStatus[] {
  return dealStatuses.includes(status as DealStatus)
    ? brokerTransitions[status as DealStatus]
    : [];
}

export function canBrokerAdvanceDeal(from: string, to: string) {
  return allowedBrokerTransitions(from).includes(to as DealStatus);
}
