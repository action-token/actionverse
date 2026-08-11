import { useDebounce } from "./useDebounce";
import { api } from "~/utils/api";

export interface SymbolCheckResult {
  symbol: string;
  derivedName: string;
  isChecking: boolean;
  available: boolean | null;
  message: string | null;
}

/**
 * Hook to auto-check Fungible Token symbol availability on-chain with debouncing.
 * Automatically sets token `name` equal to `symbol`.
 *
 * @param symbol Input token symbol string entered by creator
 * @param delay Debounce delay in ms (default: 500ms)
 */
export function useFtSymbolCheck(symbol: string, delay = 500): SymbolCheckResult {
  const cleanSymbol = symbol.trim().toUpperCase();
  const debouncedSymbol = useDebounce(cleanSymbol, delay);

  const { data, isLoading } = api.ft.checkSymbolAvailability.useQuery(
    { symbol: debouncedSymbol },
    {
      enabled: debouncedSymbol.length > 0,
      staleTime: 10_000,
    }
  );

  return {
    symbol: cleanSymbol,
    derivedName: cleanSymbol, // Name automatically equals symbol
    isChecking: isLoading && debouncedSymbol.length > 0,
    available: debouncedSymbol.length > 0 ? (data?.available ?? null) : null,
    message: debouncedSymbol.length > 0 ? (data?.message ?? null) : null,
  };
}
