import { SEARCH_RESULT_KEYS } from '../../../common/constants';
import type { GlobalSearchResponseDto } from '../dto/search.dto';

/**
 * Builds an empty global search response (e.g. manager with no teams).
 * Uses shared result keys from constants so shape stays in sync.
 */
export function createEmptySearchResponse(query: string = ''): GlobalSearchResponseDto {
  const results = Object.fromEntries(
    SEARCH_RESULT_KEYS.map((key) => [key, []]),
  ) as GlobalSearchResponseDto['results'];
  const counts = Object.fromEntries(
    SEARCH_RESULT_KEYS.map((key) => [key, 0]),
  ) as GlobalSearchResponseDto['counts'];
  return {
    query: query ?? '',
    totalResults: 0,
    results,
    counts,
  };
}
