"use client";

import { useMutation } from "@tanstack/react-query";
import { Award, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/shadcn/ui/table";
import {
  getPlotsByHolder,
  type HolderWithPlots,
} from "~/lib/stellar/action-token/script";

import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Badge } from "~/components/shadcn/ui/badge";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import { api } from "~/utils/api";
import { useRewardStore } from "./store";
import { YearMonthSelect } from "./year-month-select";

export function OriginRewards() {
  const assetsFetch = useMutation(() => getPlotsByHolder(), {
    onSuccess: (data) => {
      console.log("data", data);
      addData.mutate({ data });
    },
  });

  const { isOpen, setIsOpen, setSelectedRow, reward, currentReward } =
    useRewardStore();
  const admin = api.wallate.admin.checkAdmin.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  const addData = api.action.checker.addOriginRewardData.useMutation({
    onSuccess: () => {
      toast.success("Data added successfully");
    },
    onError: (error) => {
      toast.error("Error adding data");
      console.error("Error adding data", error);
    },
  });

  function handleRowClick(row: HolderWithPlots): void {
    setSelectedRow(row);
    setIsOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <YearMonthSelect />
          <div className="flex gap-2">
            {currentReward?.date === reward?.date ? (
              <Button
                variant="outline"
                onClick={() => assetsFetch.mutate()}
                className="flex items-center gap-2"
              >
                {assetsFetch.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Data
              </Button>
            ) : (
              <Button variant="outline" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        </div>
        {admin.data?.id && <GiftAction />}
      </div>

      <AnimatePresence>
        {!reward?.data ? (
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
        ) : reward.data.length > 0 ? (
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
                  <TableHead>Plot Token Amount</TableHead>
                  <TableHead>Plot NFT Count</TableHead>
                  <TableHead className="text-right">Total Reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reward.data
                  .sort(
                    (a, b) =>
                      b.plotBal * b.plots.length - a.plotBal * a.plots.length,
                  )
                  .map((row, index) => (
                    <TableRow
                      key={index}
                      onClick={() => handleRowClick(row)}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {row.pubkey}
                      </TableCell>
                      <TableCell>{row.plotBal}</TableCell>
                      <TableCell>{row.plots.length}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-medium">
                          {(row.plotBal * row.plots.length).toFixed(4)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="mb-4 rounded-full bg-muted p-3">
              <Award className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No reward data found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There is no reward data available for the selected period.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GiftAction() {
  const { reward } = useRewardStore();

  if (reward?.rewardedAt) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-green-700">
        <Award className="h-4 w-4" />
        <span className="text-sm font-medium">
          Rewarded on: {reward.rewardedAt.toLocaleDateString()}
        </span>
      </div>
    );
  }

  if (reward && !reward.rewardedAt) {
    return (
      <Button className="flex items-center gap-2">
        <Award className="h-4 w-4" />
        Distribute Rewards
      </Button>
    );
  }

  return null;
}
