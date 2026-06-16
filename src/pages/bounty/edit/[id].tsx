import { useEffect } from "react";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";

export default function LegacyEditBountyRedirect() {
  const router = useRouter();
  const id = router.query.id as string | undefined;

  useEffect(() => {
    if (!id) return;
    void router.replace(`/organization/bounty/edit/${id}`);
  }, [router, id]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );
}
