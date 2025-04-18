import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
    DialogClose,
} from "~/components/shadcn/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/shadcn/ui/table";
import { Loader2, UserPlus, AlertTriangle, Users } from "lucide-react";
import toast from "react-hot-toast";
import { addrShort } from "~/utils/utils";
import AdminLayout from '~/components/layout/root/AdminLayout';

const AdminAddSchema = z.object({
    pubkey: z.string().length(56, { message: "Public key must be 56 characters long" }),
});

export default function AdminManagement() {
    return (
        <AdminLayout>
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <CardTitle>Admin Management</CardTitle>
                    </div>
                    <AddAdminDialog />
                </CardHeader>
                <CardContent>
                    <AdminsList />
                </CardContent>
            </Card>
        </AdminLayout>
    );
}

function AddAdminDialog() {
    const [isOpen, setIsOpen] = React.useState(false);
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<z.infer<typeof AdminAddSchema>>({
        resolver: zodResolver(AdminAddSchema),
    });

    const addAdmin = api.wallate.admin.makeAdmin.useMutation({
        onSuccess: () => {
            toast.success("Admin added successfully");
            setIsOpen(false);
            reset();
        },
    });

    const onSubmit = (data: z.infer<typeof AdminAddSchema>) => {
        addAdmin.mutate(data.pubkey);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm shadow-foreground">
                    <UserPlus className="h-4 w-4" />
                    Add Admin
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Admin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            placeholder="Enter admin public key"
                            {...register("pubkey")}
                            className={errors.pubkey ? "border-red-500" : ""}
                        />
                        {errors.pubkey && (
                            <p className="text-sm text-red-500">{errors.pubkey.message}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <div className="flex w-full gap-2">
                            <Button variant="outline" type="button" className="w-full  shadow-sm shadow-foreground" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant='destructive'
                                type="submit" className="w-full  shadow-sm shadow-foreground" disabled={addAdmin.isLoading}>
                                {addAdmin.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Admin
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AdminsList() {
    const admins = api.wallate.admin.admins.useQuery();

    if (admins.isLoading) {
        return (
            <AdminSkeleton />
        );
    }

    if (!admins.data?.length) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Users className="h-12 w-12 mb-2" />
                <p>No admins found</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>No.</TableHead>
                        <TableHead>Public Key</TableHead>
                        <TableHead>Joined Year</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {admins.data.map((admin, i) => (
                        <TableRow key={admin.id}>
                            <TableCell className="font-medium">{i + 1}</TableCell>
                            <TableCell className="font-mono">{addrShort(admin.id, 10)}</TableCell>
                            <TableCell>{admin.joinedAt.getFullYear()}</TableCell>
                            <TableCell className="text-right">
                                <DeleteAdminButton admin={admin.id} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function DeleteAdminButton({ admin }: { admin: string }) {
    const [isOpen, setIsOpen] = React.useState(false);

    const deleteAdmin = api.wallate.admin.deleteAdmin.useMutation({
        onSuccess: () => {
            toast.success("Admin removed successfully");
            setIsOpen(false);
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="shadow-sm shadow-foreground">
                    Remove
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Remove Admin Access</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-sm">This action cannot be undone. Admin access will be immediately revoked.</p>
                </div>
                <DialogFooter>
                    <div className="flex w-full gap-2">
                        <Button variant="outline" className="w-full shadow-sm shadow-foreground" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full shadow-sm shadow-foreground"
                            onClick={() => deleteAdmin.mutate(admin)}
                            disabled={deleteAdmin.isLoading}
                        >
                            {deleteAdmin.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Remove
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const AdminSkeleton = () => {
    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <div className="h-6 w-32 animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <div className="divide-y divide-gray-200">
                        {/* Header */}
                        <div className="grid grid-cols-4 gap-4 p-4">
                            <div className="h-4 w-8 animate-pulse rounded bg-gray-200" />
                            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                            <div className="h-4 w-16 animate-pulse rounded bg-gray-200 justify-self-end" />
                        </div>

                        {/* Rows */}
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="grid grid-cols-4 gap-4 p-4">
                                <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                                <div className="h-8 w-20 animate-pulse rounded bg-gray-200 justify-self-end" />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};