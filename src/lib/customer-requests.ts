/**
 * Customer requests — "a customer asked for X and we did not have it".
 *
 * A demand signal, nothing more. Nothing here touches stock, order quantities
 * or suggestions, and no customer personal data is ever stored: there is no
 * name, phone, email or callback field anywhere in the model.
 */

export const REQUEST_KINDS = ["NOT_STOCKED", "OUT_OF_STOCK", "OTHER"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  NOT_STOCKED: "Vi säljer den inte",
  OUT_OF_STOCK: "Slut hos oss",
  OTHER: "Övrigt",
};

export const REQUEST_KIND_HELP: Record<RequestKind, string> = {
  NOT_STOCKED: "Kunden frågade efter något vi inte har i sortimentet.",
  OUT_OF_STOCK: "Vi säljer den, men den var slut just nu.",
  OTHER: "Något annat kunden efterfrågade.",
};

export const REQUEST_STATUSES = ["NEW", "CONSIDERING", "ADDED", "WONT_ADD"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: "Ny",
  CONSIDERING: "Utreds",
  ADDED: "Upplagd",
  WONT_ADD: "Läggs inte upp",
};

/** Shown under every free-text box. */
export const NO_PERSONAL_DATA_NOTICE =
  "Skriv inga personuppgifter om kunden — inget namn, telefonnummer, e-post eller “kunden vill bli uppringd”. Bara vad hen frågade efter.";

export const MAX_TEXT_LENGTH = 120;

export function isRequestKind(value: unknown): value is RequestKind {
  return typeof value === "string" && (REQUEST_KINDS as readonly string[]).includes(value);
}

export function toRequestKind(value: unknown): RequestKind {
  return isRequestKind(value) ? value : "NOT_STOCKED";
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}

export function toRequestStatus(value: unknown): RequestStatus {
  return isRequestStatus(value) ? value : "NEW";
}

/** Free text is capped so a note cannot become a paragraph about a customer. */
export function clampText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : null;
}

/**
 * The dedup key: lowercased, diacritics stripped, every separator removed.
 *
 * So "Zyn  Cool Mint", "zyn cool mint" and "ZYN Cöol Mint" all land on the
 * same row and increment its count rather than creating three.
 *
 * Separators are dropped rather than collapsed to spaces, because collapsing
 * cannot satisfy both halves of the problem: "G.3" and "G3" are the same
 * brand, while "Extra-Strong" and "Extra Strong" are the same strength —
 * turning punctuation into a space fixes the second and breaks the first.
 * The key is internal; the admin list shows the text as it was typed, so a
 * compact token costs nothing in readability.
 */
export function normalizeKey(brand: string | null, flavor: string | null): string {
  return [brand, flavor]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Neither punctuation nor spacing should split an identical request.
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * For OUT_OF_STOCK the request is about a product we carry, so the product id
 * is the key — two people logging the same sold-out product must land on one
 * row even if they typed the name differently.
 */
export function keyForProduct(productId: string): string {
  return `product:${productId}`;
}

/** The key a request should be stored under, given what it is about. */
export function dedupKey(input: {
  kind: RequestKind;
  productId?: string | null;
  brandText?: string | null;
  flavorText?: string | null;
}): string {
  if (input.productId) return keyForProduct(input.productId);
  return normalizeKey(input.brandText ?? null, input.flavorText ?? null);
}
