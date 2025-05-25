"use client"

import { Award } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"

import { UserDialog } from "~/components/reward-checker/user-dialog"
import { api } from "~/utils/api"
import { AdminOriginRewards } from "~/components/reward-checker/admin/admin-origin-rewards"
import { AdminQuarterRewards } from "~/components/reward-checker/admin/admin-quarter"
import AdminLayout from "~/components/layout/root/AdminLayout"

export default function AdminAssetChecker() {
  return (
    <AdminLayout>
      <div className="container mx-auto min-h-screen py-8 px-4 space-y-8">
        <div className="flex flex-col space-y-2 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight">Asset Checker</h1>
          <p className="text-muted-foreground text-lg">Check and manage your Stellar blockchain assets and rewards</p>
        </div>

        <Card className=" shadow-md">
          <CardHeader className="border-b bg-muted/40">
            <CardTitle className="text-2xl">Rewards Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="originRewards" className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="originRewards" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <span>Origin Rewards</span>
                </TabsTrigger>
                <TabsTrigger value="quarterRewards" className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <span>Quarter Rewards</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="originRewards" className="mt-0">
                <AdminOriginRewards />
              </TabsContent>

              <TabsContent value="quarterRewards" className="mt-0">
                <AdminQuarterRewards />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <UserDialog />
      </div>
    </AdminLayout>
  )
}

function Test() {
  const test = api.trigger.test.useMutation()
  return (
    <div className="max-w-4xl mx-auto mt-8 p-4 border rounded-lg">
      {test.isLoading && <p className="text-amber-600">Loading...</p>}
      {test.isError && <p className="text-red-600">Error: {test.error.message}</p>}
      {test.isSuccess && <p className="text-green-600">Success: {JSON.stringify(test.data)}</p>}
      <button
        onClick={() => test.mutate()}
        className="mt-2 rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors"
      >
        Trigger Test
      </button>
    </div>
  )
}
