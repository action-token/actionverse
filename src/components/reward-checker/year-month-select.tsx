"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import { holderWithPlotsSchema } from "~/lib/stellar/action-token/script";
import { api } from "~/utils/api";
import { useRewardStore } from "./store";

export function YearMonthSelect() {
  const { setReward, reward, setCurrentReward } = useRewardStore();

  const rewards = api.action.checker.getAllOriginRewards.useQuery(undefined, {
    onSuccess(data) {
      const first = data[0];
      if (first) {
        setCurrentReward({
          date: first.monthYear,
          data: holderWithPlotsSchema.array().parse(first.data),
        });

        setReward({
          date: first.monthYear,
          rewardedAt: first.rewardedAt ?? undefined,
          data: holderWithPlotsSchema.array().parse(first.data),
        });
      }
    },
  });

  const handleSelect = (value: string) => {
    const reward = rewards.data?.find((reward) => {
      console.log("reward", typeof reward.monthYear);
      return reward.monthYear === value;
    });
    if (reward) {
      const jsonData = reward.data;
      const data = holderWithPlotsSchema.array().parse(jsonData);
      setReward({
        date: value,
        rewardedAt: reward.rewardedAt ?? undefined,
        data,
      });
    }
  };

  return (
    <div className="w-full sm:w-[240px]">
      {rewards.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Select onValueChange={handleSelect} value={reward?.date}>
          <SelectTrigger id="year-month-select" className="w-full">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {rewards.data?.map((option) => (
              <SelectItem key={option.id} value={option.monthYear}>
                {option.monthYear}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
