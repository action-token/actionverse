import { Download, Loader2 } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/shadcn/ui/table"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import type { PinLocation } from "~/types/pin"
import { api } from "~/utils/api"
import type React from "react" // Added import for React
import AdminLayout from "~/components/layout/root/AdminLayout"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"

export default function AdminPinConsumptionReport() {
    const { data: pins, isLoading } = api.maps.pin.getAllConsumedLocation.useQuery()

    return (
        <AdminLayout>
            <Card>
                <CardHeader className="bg-primary">
                    <h2 className=" text-center text-2xl font-bold">All Collection Reports</h2>
                    <div className="flex items-center flex-col lg:flex-row justify-center  gap-2 ">
                        <ReportDownload day={7}>Download Weekly Collection Report</ReportDownload>
                        <ReportDownload day={30}>Download Monthly Collection Report</ReportDownload>
                    </div>
                </CardHeader>
                <CardContent className="min-h-screen">
                    <div className="">
                        <TableDemo pins={pins} isLoading={isLoading} />
                    </div>
                </CardContent>
            </Card>
        </AdminLayout>
    )
}

function TableDemo({ pins, isLoading }: { pins?: PinLocation[]; isLoading: boolean }) {
    return (
        <div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Lat Lan</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Consumer</TableHead>
                        <TableHead>Collection Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Skeleton className="h-4 w-[100px]" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-[120px]" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-[100px]" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-[140px]" />
                                </TableCell>
                            </TableRow>
                        ))
                        : pins?.map((pin) => (
                            <TableRow key={pin.id}>
                                <TableCell className="font-medium">
                                    {`${pin.location.latitude.toFixed(4)}-${pin.location.longitude.toFixed(4)}`}
                                </TableCell>
                                <TableCell className="font-medium">{pin.location.creator.name}</TableCell>
                                <TableCell>{pin.user.name}</TableCell>
                                <TableCell>{pin.createdAt.toDateString()}</TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>
        </div>
    )
}

function ReportDownload({ day, children }: { day: number; children?: React.ReactNode }) {
    const download = api.maps.pin.downloadAllConsumedLocation.useMutation({
        onSuccess: (data) => {
            DownloadPinLocationAsCSV(data)
        },
    })

    return (
        <Button
            className="shadow-sm shadow-foreground"
            variant='vibrant'
            onClick={() => download.mutate({ day })} disabled={download.isLoading}>
            {download.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {children}
        </Button>
    )
}

function DownloadPinLocationAsCSV(data: PinLocation[]) {
    const csvContent = [
        ["latitude", "longitude", "creator", "consumer", "consumed_at"],
        ...data.map((pin) => [
            pin.location.latitude,
            pin.location.longitude,
            pin.location.creator.name,
            pin.user.name,
            pin.createdAt.toDateString(),
        ]),
    ]
        .map((e) => e.join(","))
        .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "pin_locations.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

