/** Purpose collection applicability — source of truth on PaymentPurpose. */
export const COLLECTION_SCOPES = ["sold", "all"] as const;
export type CollectionScope = (typeof COLLECTION_SCOPES)[number];

export const DEFAULT_COLLECTION_SCOPE: CollectionScope = "sold";

export function normalizeCollectionScope(value: unknown): CollectionScope {
  return value === "all" ? "all" : "sold";
}

export function collectionScopeLabel(scope: CollectionScope): string {
  return scope === "all" ? "All Flats" : "Sold Flats Only";
}

export function collectionScopeShortLabel(scope: CollectionScope): string {
  return scope === "all" ? "All Flats" : "Sold Flats";
}
