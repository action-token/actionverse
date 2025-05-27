"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Search, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import toast from "react-hot-toast";
import { Avatar, AvatarFallback } from "~/components/shadcn/ui/avatar";
import { Badge } from "~/components/shadcn/ui/badge";
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
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";

export function Checker() {
  const [checkerSearch, setCheckerSearch] = useState("");
  const [tokens, setToken] = useState<
    {
      asset_code: string;
      asset_issuer: string;
      balance: string;
    }[]
  >([]);

  const wallet = useMutation(
    async () => {
      const acc = await StellarAccount.create(checkerSearch);
      return acc.getNfts();
    },
    {
      onSuccess: (data) => {
        setToken(data);
        if (data.length > 0) {
          toast.success(`Found ${data.length} assets`);
        } else {
          toast.error("No assets found for this wallet");
        }
      },
      onError: (error) => {
        console.error("Error fetching wallet data", error);
        toast.error("Failed to fetch wallet data");
      },
    },
  );

  const handleSearch = () => {
    if (!checkerSearch.trim()) {
      toast.error("Please enter a wallet address");
      return;
    }
    wallet.mutate();
  };

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
            placeholder="Enter wallet address"
            value={checkerSearch}
            onChange={(e) => setCheckerSearch(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={wallet.isLoading || !checkerSearch.trim()}
          className="w-full self-end sm:w-auto"
        >
          {wallet.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            "Search Wallet"
          )}
        </Button>
      </div>

      <AnimatePresence>
        {wallet.isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center space-x-4 rounded-lg border p-4"
              >
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : tokens.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Asset Issuer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((row, index) => (
                  <TableRow
                    key={index}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {row.asset_code.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        {row.asset_code}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {row.asset_issuer}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{row.balance}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        ) : checkerSearch && !wallet.isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="mb-4 rounded-full bg-muted p-3">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No assets found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This wallet doesn{"'t"} have any assets or the address may be
              incorrect.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
