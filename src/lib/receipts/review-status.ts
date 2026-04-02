export const REVIEW_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Entwurf" },
  { value: "IN_REVIEW", label: "In Pruefung" },
  { value: "APPROVED", label: "Freigegeben" },
  { value: "DEFERRED", label: "Zurueckgestellt" },
  { value: "COMPLETED", label: "Abgeschlossen" },
] as const;

export type ReviewStatusValue = (typeof REVIEW_STATUS_OPTIONS)[number]["value"];

export const REVIEW_STATUS_LABELS: Record<ReviewStatusValue, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Pruefung",
  APPROVED: "Freigegeben",
  DEFERRED: "Zurueckgestellt",
  COMPLETED: "Abgeschlossen",
};

export const REVIEW_STATUS_BADGE_CLASSES: Record<ReviewStatusValue, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  IN_REVIEW: "bg-accent/20 text-accent-foreground",
  APPROVED: "bg-primary/10 text-primary",
  DEFERRED: "bg-danger/10 text-danger",
  COMPLETED: "bg-primary/20 text-primary",
};

export function getReviewStatusLabel(status: string) {
  return REVIEW_STATUS_LABELS[status as ReviewStatusValue] ?? status;
}

export function getReviewStatusBadgeClass(status: string) {
  return REVIEW_STATUS_BADGE_CLASSES[status as ReviewStatusValue] ?? "";
}
