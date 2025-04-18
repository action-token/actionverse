import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "~/components/layout/root/AdminLayout";

const AdminHome: React.FC = () => {
    const router = useRouter();

    useEffect(() => {
        router.push("/admin/wallet");
    }, [router]);

    return (
        <AdminLayout>
            <div>Redirecting to wallet...</div>
        </AdminLayout>
    );
}

export default AdminHome;