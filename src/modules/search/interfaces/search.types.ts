/**
 * Search module types and interfaces.
 */

/** Single search result item (card/title/description + metadata). */
export interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  module: string;
  metadata?: Record<string, unknown>;
}

/** Result of one module search: items + total count. */
export interface SearchModuleResult {
  items: SearchResultItem[];
  total: number;
}
