"use client"
import { Users, Grid3X3, ImageIcon, DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { CreatorWithPageAsset } from "~/types/organization/dashboard"

interface StatsWidgetProps {
    editMode?: boolean
    creatorData: CreatorWithPageAsset
}



export default function StatsWidget({ editMode, creatorData }: StatsWidgetProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-2 h-full">
            <Card className="border-none shadow-none">
                <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Followers</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center">
                        <Users className="h-5 w-5 text-muted-foreground mr-2" />
                        <div className="text-2xl font-bold">{creatorData._count.followers}</div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-none">
                <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Posts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center">
                        <Grid3X3 className="h-5 w-5 text-muted-foreground mr-2" />
                        <div className="text-2xl font-bold">{creatorData._count.posts}</div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-none">
                <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total NFTs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground mr-2" />
                        <div className="text-2xl font-bold">{creatorData._count.assets}</div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-none">
                <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center">
                        <DollarSign className="h-5 w-5 text-muted-foreground mr-2" />
                        <div className="text-2xl font-bold">
                            {creatorData._count.revenue ?? 0}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
