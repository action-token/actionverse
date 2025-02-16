import React from "react";
import toast from "react-hot-toast";
import { Button } from "~/components/shadcn/ui/button";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/shadcn/ui/table";
import { addrShort } from "~/utils/utils";
import { api } from "~/utils/api";
import { Card, CardContent } from "~/components/shadcn/ui/card";
import AdminLayout from "~/components/layout/root/AdminLayout";

export default function CreatorPage() {
    return (
        <AdminLayout>

            <Creators />

        </AdminLayout>
    );
}

function CreatorTableSkeleton() {
    return (
        <div className="w-full">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Pubkey</TableHead>
                        <TableHead>Joined At</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Delete</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array({ length: 5 })].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function Creators() {
    const creators = api.admin.creator.getCreators.useQuery();

    if (creators.isLoading) return <CreatorTableSkeleton />;
    if (creators.error) return <div className="text-red-500">Error loading creators</div>;

    return (
        <Card className="w-full">
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Pubkey</TableHead>
                            <TableHead>Joined At</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Delete</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {creators.data?.map((creator, i) => (
                            <TableRow key={creator.id}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell className="font-medium">{creator.name}</TableCell>
                                <TableCell>{addrShort(creator.id, 10)}</TableCell>
                                <TableCell>{creator.joinedAt.toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <ActionButton
                                        creatorId={creator.id}
                                        status={creator.approved}
                                    />
                                </TableCell>
                                <TableCell>
                                    <DeleteCreatorButton creatorId={creator.id} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ActionButton({
    status,
    creatorId,
}: {
    status: boolean | null;
    creatorId: string;
}) {
    const actionM = api.admin.creator.creatorAction.useMutation();

    const handleClick = (action: boolean | null) => {
        actionM.mutate({ creatorId, status: action });
    };

    if (status === null) {
        return (
            <Button
                disabled={actionM.isLoading}
                className="shadow-sm shadow-foreground"
                onClick={() => handleClick(true)}
            >
                {actionM.isLoading ? (
                    <Skeleton className="h-4 w-16" />
                ) : (
                    "APPROVE"
                )}
            </Button>
        );
    }

    if (status === false) {
        return (
            <Button
                disabled={actionM.isLoading}
                className="shadow-sm shadow-foreground  min-w-24"
                variant="cool"
                onClick={() => handleClick(true)}
            >
                {actionM.isLoading ? (
                    <Skeleton className="h-4 w-16" />
                ) : (
                    "UNBAN"
                )}
            </Button>
        );
    }

    return (
        <Button
            variant="destructive"
            disabled={actionM.isLoading}
            className="shadow-sm shadow-foreground   min-w-24"

            onClick={() => handleClick(false)}
        >
            {actionM.isLoading ? (
                <Skeleton className="h-4 w-16" />
            ) : (
                "BAN"
            )}
        </Button>
    );
}

function DeleteCreatorButton({ creatorId }: { creatorId: string }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const deleteCreator = api.admin.creator.deleteCreator.useMutation({
        onSuccess: () => {
            toast.success("Creator deleted");
            setIsOpen(false);
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="warm"
                    className="shadow-sm shadow-foreground "

                >
                    {deleteCreator.isLoading ? (
                        <Skeleton className="h-4 w-16" />
                    ) : (
                        "Delete"
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Confirmation</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p>Are you sure you want to delete this creator? This action is irreversible.</p>
                </div>
                <DialogFooter>
                    <div className="flex w-full gap-4">
                        <DialogClose asChild>
                            <Button variant="outline" className="w-full shadow-sm shadow-foreground">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => deleteCreator.mutate(creatorId)}
                            disabled={deleteCreator.isLoading}
                            className="w-full shadow-sm shadow-foreground"
                        >
                            {deleteCreator.isLoading ? (
                                <Skeleton className="h-4 w-16" />
                            ) : (
                                "Confirm"
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}