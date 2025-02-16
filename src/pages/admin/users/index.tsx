import React from "react";
import { toast } from "react-hot-toast";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table";
import { Search, Trash2, Loader2, Users } from "lucide-react";
import { Input } from "~/components/shadcn/ui/input";
import AdminLayout from "~/components/layout/root/AdminLayout";
import { Skeleton } from "~/components/shadcn/ui/skeleton";

const UserList = () => {
    const [searchQuery, setSearchQuery] = React.useState("");
    const users = api.admin.user.getUsers.useQuery();

    const filteredUsers = React.useMemo(() => {
        if (!users.data) return [];
        return users.data.filter(user =>
            user.id.toLowerCase().includes(searchQuery.toLowerCase()) ??
            user.bio?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [users.data, searchQuery]);

    if (users.isLoading) {
        return (
            <AdminLayout>
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <div className="relative">
                            <Search className="absolute left-2 top-3 h-4 w-4 text-gray-500" />
                            <Input placeholder="Search users..." className="pl-8" disabled />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No.</TableHead>
                                    <TableHead>Public Key</TableHead>
                                    <TableHead>Bio</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array({ length: 5 })].map((_, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-8" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-40" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-8 ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </AdminLayout>
        );
    }

    if (users.isError) {
        return (
            <div className="flex h-48 items-center justify-center">
                <p className="text-red-500">Failed to load users. Please try again later.</p>
            </div>
        );
    }

    return (
        <AdminLayout>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2 top-3 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search users..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No.</TableHead>
                                <TableHead>Public Key</TableHead>
                                <TableHead>Bio</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user, index) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                    <TableCell className="font-mono">{user.id}</TableCell>
                                    <TableCell>{user.bio ?? "No bio"}</TableCell>
                                    <TableCell className="text-right">
                                        <DeleteUserButton user={user.id} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredUsers.length === 0 && (
                        <div className="py-8 text-center text-gray-500">
                            No users found matching your search.
                        </div>
                    )}
                </CardContent>
            </Card>
        </AdminLayout>
    );
};

const DeleteUserButton = ({ user }: { user: string }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const deleteUser = api.admin.user.deleteUser.useMutation({
        onSuccess: () => {
            toast.success("User deleted successfully");
            setIsOpen(false);
        },
        onError: () => {
            toast.error("Failed to delete user");
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="icon"
                    className="shadow-sm shadow-foreground"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete User</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete this user? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        className="shadow-sm shadow-foreground"

                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        disabled={deleteUser.isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="shadow-sm shadow-foreground"

                        variant="destructive"
                        onClick={() => deleteUser.mutate(user)}
                        disabled={deleteUser.isLoading}
                    >
                        {deleteUser.isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Delete User
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UserList;