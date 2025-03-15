"use client";

import { Button } from "~/components/shadcn/ui/button";
import { api } from "~/utils/api";
import CustomAvatar from "../common/custom-avatar";
import { useToast } from "~/hooks/use-toast";
import { Loader2, UserX } from "lucide-react";
import { useState } from "react";

export default function CreatorSidebar() {
  const toast = useToast();
  const [unFollowLoadingId, setUnFollowLoadingId] = useState("");
  const unFollow = api.fan.member.unFollowCreator.useMutation({
    onSuccess: async () => {
      toast.toast({
        title: "Creator Unfollowed",
        variant: "default",
      });
    },
    onError: (e) =>
      toast.toast({
        title: "Failed to unfollow creator",
        variant: "destructive",
      }),
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    api.fan.creator.getFollowedCreators.useInfiniteQuery(
      { limit: 3 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  // Flatten the pages data for rendering
  const followedCreators = data?.pages.flatMap((page) => page.creators) ?? [];

  return (
    <div className="space-y-3">
      {followedCreators.length === 0 && (
        <p className="text-center  text-sm">
          You are not following any creator
        </p>
      )}
      {followedCreators.map((creator) => (
        <div
          key={creator.id}
          className="flex items-center gap-3 rounded-lg p-2 "
        >
          <CustomAvatar url={creator.profileUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{creator.name}</p>
              <Button
                onClick={() => {
                  unFollow.mutate({ creatorId: creator.id });
                  setUnFollowLoadingId(creator.id);
                }}
                variant="destructive"
                size="sm"
                className=" shadow-sm shadow-foreground"
                disabled={unFollow.isLoading}
              >
                {unFollow.isLoading && unFollowLoadingId === creator.id ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <UserX className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ))}
      {hasNextPage && (
        <Button
          size="sm"
          variant="link"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading..." : "Load More"}
        </Button>
      )}
    </div>
  );
}
