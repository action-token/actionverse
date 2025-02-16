"use client"

import type { Location, LocationGroup } from "@prisma/client"
import { Check, ChevronDown, ChevronUp, X } from "lucide-react"
import Image from "next/image"
import React, { type ReactNode, useState } from "react"
import toast from "react-hot-toast"
import AdminLayout from "~/components/layout/root/AdminLayout"
import { Button } from "~/components/shadcn/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/shadcn/ui/collapsible"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { CREATOR_TERM } from "~/utils/term"

export default function Pins() {
    const locationGroups = api.maps.pin.getLocationGroups.useQuery()

    if (locationGroups.isLoading)
        return (
            <AdminLayout>
                <div className="space-y-4">
                    <Skeleton className="h-8 w-[200px]" />
                    {[...Array({ length: 3 })].map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ))}
                </div>
            </AdminLayout>
        )
    if (locationGroups.error) return <div>Error: {locationGroups.error.message}</div>

    if (locationGroups.data) {
        return (
            <AdminLayout>
                <GroupPins groups={locationGroups.data} />
            </AdminLayout>
        )
    }
}

type GroupPins = LocationGroup & {
    locations: Location[]
    creator: { name: string }
}

type Group = Record<string, GroupPins[]>

function GroupPins({ groups }: { groups: GroupPins[] }) {
    const groupPins: Group = {}

    groups.forEach((group) => {
        const locationGroupId = group.id
        if (groupPins[locationGroupId]) {
            groupPins[locationGroupId].push(group)
        } else {
            groupPins[locationGroupId] = [group]
        }
    })

    return (
        <>
            <div className=" h-screen flex flex-col items-center justify-center">
                <PinsList groups={groupPins} />
            </div>
        </>
    )
}

function PinsList({ groups }: { groups: Group }) {
    const [selectedGroup, setSelectedGroup] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const approveM = api.maps.pin.approveLocationGroups.useMutation({
        onMutate: () => setIsLoading(true),
        onSettled: () => setIsLoading(false),
        onSuccess: (data, variable) => {
            if (variable.approved) toast.success("Pins Approved Successfully!")
            if (!variable.approved) toast.error("Pins Rejected Successfully!")
            setSelectedGroup([])
        },
        onError: (error) => {
            toast.error("Operation failed: " + error.message)
        },
    })

    function handleGroupSelection(groupId: string) {
        setSelectedGroup((prev) => {
            if (prev.includes(groupId)) {
                return prev.filter((id) => id !== groupId)
            } else {
                return [...prev, groupId]
            }
        })
    }

    return (
        <div className="min-w-2xl p-2">
            {Object.entries(groups).map(([key, pins]) => (
                <CollapsibleDemo
                    key={key}
                    header={
                        <div className="flex items-center gap-2">
                            <label>
                                <input type="checkbox" className="checkbox" onChange={(e) => handleGroupSelection(key)} />
                            </label>
                            Pin Groups {key} { }
                        </div>
                    }
                    content={
                        <div className="overflow-x-auto">
                            <table className="table table-zebra ml-5 w-full">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Title</th>
                                        <th>Image</th>
                                        <th>{CREATOR_TERM} Name</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pins.map((pin) => (
                                        <tr key={pin.id}>
                                            <th>{pin.id}</th>
                                            <td>{pin.title}</td>
                                            <td>
                                                {pin.image && (
                                                    <Image alt="pin image" width={50} height={50} src={pin.image || "/placeholder.svg"} />
                                                )}
                                            </td>
                                            <td>{pin.creator.name}</td>
                                            <td>{pin.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    }
                />
            ))}

            <div className="flex w-full py-4">
                <div className="flex w-full items-end justify-end gap-4">
                    <Button
                        variant="default"
                        onClick={() => {
                            approveM.mutate({
                                locationGroupIds: selectedGroup,
                                approved: true,
                            })
                        }}
                        disabled={selectedGroup.length === 0 || isLoading}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() =>
                            approveM.mutate({
                                locationGroupIds: selectedGroup,
                                approved: false,
                            })
                        }
                        disabled={selectedGroup.length === 0 || isLoading}
                    >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                    </Button>
                </div>
            </div>
        </div>
    )
}

export function CollapsibleDemo({
    content,
    header,
}: {
    header: ReactNode
    content: ReactNode
}) {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="min-w-lg space-y-2">
            <div className="flex items-center justify-between space-x-4 px-4">
                <h4 className="text-sm font-semibold">{header}</h4>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                        {isOpen ? <ChevronUp /> : <ChevronDown />}
                        <span className="sr-only">Toggle</span>
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2">{content}</CollapsibleContent>
        </Collapsible>
    )
}

function Group() {
    return (
        <table className="table table-zebra">
            <thead>
                <tr>
                    <th></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    )
}

