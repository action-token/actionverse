import { useEffect } from "react";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";

export default function LegacyCreateBountyRedirect() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/organization/bounty/create");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );
}
