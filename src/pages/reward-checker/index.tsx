"use client";

import { Award, BarChart3, Wallet } from "lucide-react";
import { Card, CardContent } from "~/components/shadcn/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/shadcn/ui/tabs";
import { QuarterRewards } from "~/components/reward-checker/quarter";
import { AssetHolders } from "~/components/reward-checker/asset-holders";
import { Checker } from "~/components/reward-checker/checker";
import { OriginRewards } from "~/components/reward-checker/origin-rewards";
import { UserDialog } from "~/components/reward-checker/user-dialog";
import { api } from "~/utils/api";

export default function AssetChecker() {
  return (
    <div className="container mx-auto h-screen space-y-6 p-4">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Asset Checker</h1>
        <p className="text-muted-foreground">
          Check and manage your Stellar blockchain assets and rewards
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="checker" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-4">
              <TabsTrigger value="checker" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span>Checker</span>
              </TabsTrigger>
              <TabsTrigger
                value="assetHolder"
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Asset Holder</span>
              </TabsTrigger>
              <TabsTrigger
                value="originRewards"
                className="flex items-center gap-2"
              >
                <Award className="h-4 w-4" />
                <span>Origin Rewards</span>
              </TabsTrigger>
              <TabsTrigger
                value="quarterRewards"
                className="flex items-center gap-2"
              >
                <Award className="h-4 w-4" />
                <span>Quarter Rewards</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checker" className="mt-0">
              <Checker />
            </TabsContent>

            <TabsContent value="assetHolder" className="mt-0">
              <AssetHolders />
            </TabsContent>

            <TabsContent value="originRewards" className="mt-0">
              <OriginRewards />
            </TabsContent>

            <TabsContent value="quarterRewards" className="mt-0">
              <QuarterRewards />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <UserDialog />

      {/* <Test /> */}
    </div>
  );
}

function Test() {
  const test = api.trigger.test.useMutation();
  return (
    <div>
      {test.isLoading && <p>Loading..</p>}
      {test.isError && <p>Error: {test.error.message}</p>}
      {test.isSuccess && <p>Success: {JSON.stringify(test.data)}</p>}
      <p>dfd</p>
      <button
        onClick={() => test.mutate()}
        className="rounded-md bg-blue-500 px-4 py-2 text-white"
      >
        Trigger Test
      </button>
    </div>
  );
}
