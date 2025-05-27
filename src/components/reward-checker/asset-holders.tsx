"use client";

import { useMutation } from "@tanstack/react-query";
import { BarChart3, ChevronRight, Loader2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Avatar, AvatarFallback } from "~/components/shadcn/ui/avatar";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/shadcn/ui/table";
import { useDebounce } from "~/hooks/use-debounce";
import { NftHolder, server } from "~/lib/stellar/action-token";
import { AssetType } from "./types";

export function AssetHolders() {
  const [assetHolderSearch, setAssetHolderSearch] = useState("");
  const [suggestions, setSuggestions] = useState<AssetType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedSearch = useDebounce(assetHolderSearch, 300);

  const [holderData, setHolderData] = useState<
    { pubkey: string; amount: number; rank: number }[]
  >([]);

  const holder = useMutation(
    async () => {
      const [assetCode, assetIssuer] = assetHolderSearch.split("-");
      if (!assetCode || !assetIssuer) return;
      const holder = await NftHolder.initiate({
        code: assetCode,
        issuer: assetIssuer,
      });
      return holder.getHolders();
    },
    {
      onSuccess: (data) => {
        if (data) {
          setHolderData(data);
          toast.success(`Found ${data.length} holders`);
        }
      },
      onError: () => {
        toast.error("Failed to fetch holder data");
      },
    },
  );

  function handleSearch() {
    if (!assetHolderSearch.includes("-")) {
      toast.error("Please select an asset from the suggestions");
      return;
    }
    holder.mutate();
  }

  useEffect(() => {
    const fetchAssetSuggestions = async () => {
      if (debouncedSearch.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const data = await server
          .assets()
          .forCode(debouncedSearch)
          .limit(5)
          .call();
        const assets = data.records.map((record) => ({
          code: record.asset_code,
          issuer: record.asset_issuer,
        }));
        setSuggestions(assets);
      } catch (error) {
        console.error("Error fetching asset suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssetSuggestions();
  }, [debouncedSearch]);

  function handleSuggestionClick(suggestion: AssetType): void {
    setSuggestions([]);
    setAssetHolderSearch(`${suggestion.code}-${suggestion.issuer}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col space-y-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            placeholder="Search for an asset (e.g. XLM, USDC)"
            value={assetHolderSearch}
            onChange={(e) => setAssetHolderSearch(e.target.value)}
            className="pl-10"
          />
          {(suggestions.length > 0 || isLoading) && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
              {isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching assets...
                </div>
              ) : (
                suggestions.map((suggestion, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.05 }}
                    className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-muted"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {suggestion.code.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{suggestion.code}</div>
                        <div className="max-w-[300px] truncate text-xs text-muted-foreground">
                          {suggestion.issuer}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setAssetHolderSearch("")}
            disabled={!assetHolderSearch || holder.isLoading}
          >
            Clear
          </Button>
          <Button
            onClick={handleSearch}
            disabled={holder.isLoading || !assetHolderSearch.includes("-")}
          >
            {holder.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Find Holders"
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {holder.isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </motion.div>
        ) : holderData.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holderData.map((row, index) => (
                  <TableRow
                    key={index}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{row.rank}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {row.pubkey}
                    </TableCell>
                    <TableCell className="text-right">{row.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        ) : assetHolderSearch.includes("-") && !holder.isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="mb-4 rounded-full bg-muted p-3">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No holders found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This asset doesn{"'t"} have any holders or the asset information
              may be incorrect.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
