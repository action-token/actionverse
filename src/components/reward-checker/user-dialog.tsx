"use client";

import { Copy, ExternalLink, Info } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "~/components/shadcn/ui/badge";
import { Button } from "~/components/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/shadcn/ui/table";
import { useRewardStore } from "./store";

export function UserDialog() {
  const { setSelectedRow, selectedRow, isOpen, setIsOpen } = useRewardStore();

  if (!selectedRow) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  const totalReward = selectedRow.plotBal * selectedRow.plots.length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Account Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about this account and its assets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Account Info */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">
                Public Key
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(selectedRow.pubkey)}
                  title="Copy to clipboard"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    window.open(
                      `https://stellar.expert/explorer/public/account/${selectedRow.pubkey}`,
                      "_blank",
                    )
                  }
                  title="View on Stellar Explorer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-1 break-all text-sm">{selectedRow.pubkey}</div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">Plot Balance</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold">{selectedRow.plotBal}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">Plot Count</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold">
                  {selectedRow.plots.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">Total Reward</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-2xl font-bold text-primary">
                  {totalReward.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plot NFTs */}
          {selectedRow.plots.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span>Plot NFTs</span>
                <Badge variant="outline">
                  {selectedRow.plots.length} plots
                </Badge>
              </div>

              {selectedRow.plots.length <= 10 ? (
                <div className="max-h-60 overflow-y-auto rounded-md border p-2">
                  {selectedRow.plots.map((plot, index) => {
                    // Handle different plot data formats
                    let plotDetails;
                    if (typeof plot === "object" && plot !== null) {
                      // For object format (with asset_code, asset_issuer, balance)
                      plotDetails = (
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-start gap-2">
                            <span className="text-muted-foreground">Code:</span>
                            <span className="font-medium">
                              {plot.asset_code}
                            </span>
                          </div>
                          <div className="flex items-center justify-start gap-2">
                            <span className="text-muted-foreground">
                              Issuer:
                            </span>
                            <span className="truncate font-mono text-xs ">
                              {plot.asset_issuer}
                            </span>
                          </div>
                          <div className="flex items-center justify-start gap-2">
                            <span className="text-muted-foreground">
                              Balance:
                            </span>
                            <span>{plot.balance}</span>
                          </div>
                        </div>
                      );
                    } else {
                      // For string or other primitive values
                      plotDetails = (
                        <Badge variant="outline">{String(plot)}</Badge>
                      );
                    }

                    return (
                      <div
                        key={index}
                        className={`rounded-sm border-b px-1 py-2  last:border-0
                                                ${index % 2 === 0 ? "bg-secondary" : "bg-muted/5"}`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium">Plot #{index + 1}</span>
                        </div>
                        {plotDetails}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plot #</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Issuer</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="max-h-60 overflow-y-auto">
                        {selectedRow.plots.slice(0, 50).map((plot, index) => {
                          // Handle different plot data formats
                          if (
                            typeof plot === "object" &&
                            plot !== null &&
                            "asset_code" in plot
                          ) {
                            return (
                              <TableRow key={index}>
                                <TableCell className="py-2">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="py-2">
                                  {plot.asset_code}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate py-2 font-mono text-xs">
                                  {plot.asset_issuer}
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  {plot.balance}
                                </TableCell>
                              </TableRow>
                            );
                          } else {
                            return (
                              <TableRow key={index}>
                                <TableCell className="py-2">
                                  {index + 1}
                                </TableCell>
                                <TableCell
                                  className="py-2 font-mono text-xs"
                                  colSpan={3}
                                >
                                  {String(plot)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedRow.plots.length > 50 && (
                    <div className="text-center text-sm text-muted-foreground">
                      Showing 50 of {selectedRow.plots.length} plots
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-start">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
