import { OriginReward } from "@prisma/client";
import { Award, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/shadcn/ui/button";
import { api } from "~/utils/api";

export function DistributeQuarterReward({ data }: { data: OriginReward }) {
  const utils = api.useUtils();

  const distributeRewards =
    api.action.checker.distributeOriginRewards.useMutation({
      onSuccess: () => {
        toast.success("Rewards distributed successfully");
        utils.action.checker.getOriginReward.invalidate();
      },
      onError: (error) => {
        toast.error("Error distributing rewards");
        console.error("Error distributing rewards", error);
      },
    });

  const handleDistribute = () => {
    distributeRewards.mutate(data);
  };
  return (
    <Button
      className="flex items-center gap-2"
      disabled={distributeRewards.isLoading}
      onClick={handleDistribute}
    >
      {distributeRewards.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Award className="h-4 w-4" />
      )}
      Distribute Rewards
    </Button>
  );
}
