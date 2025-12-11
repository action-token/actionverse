"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { UserRoundPlus, UserX, Loader2 } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import { clientsign } from "package/connect_wallet";
import { clientSelect } from "~/lib/stellar/fan/utils";
import useNeedSign from "~/lib/hook";

interface FollowCreatorButtonProps {
  creatorId: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  showText?: boolean;
}

export default function FollowCreatorButton({
  creatorId,
  className = "",
  size = "sm",
  variant = "default",
  showText = true,
}: FollowCreatorButtonProps) {
  const session = useSession();
  const { needSign } = useNeedSign();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);

  // Check if current user is the creator
  const isCurrentUser = session.data?.user.id === creatorId;

  // Don't render button if user is viewing their own page or not logged in
  if (isCurrentUser || !session.data?.user.id) {
    return null;
  }

  // Check if current user is following this creator
  const followStatusQuery =
    api.fan.creator.getFollowedCreators.useInfiniteQuery(
      { limit: 100 },
      {
        enabled: !!session.data?.user.id && !!creatorId,
        onSuccess: (data) => {
          const followedCreators =
            data?.pages.flatMap((page) => page.creators) ?? [];
          const isUserFollowing = followedCreators.some(
            (c) => c.id === creatorId,
          );
          setIsFollowing(isUserFollowing);
        },
      },
    );

  // Follow mutation
  const follow = api.fan.member.followCreator.useMutation({
    onSuccess: () => {
      toast({
        title: "Creator Followed",
        variant: "default",
      });
      setIsFollowing(true);
      followStatusQuery.refetch();
    },
    onError: (e) =>
      toast({
        title: "Failed to follow creator",
        variant: "destructive",
      }),
  });

  // Unfollow mutation
  const unFollow = api.fan.member.unFollowCreator.useMutation({
    onSuccess: () => {
      toast({
        title: "Creator Unfollowed",
        variant: "default",
      });
      setIsFollowing(false);
      followStatusQuery.refetch();
    },
    onError: (e) =>
      toast({
        title: "Failed to unfollow creator",
        variant: "destructive",
      }),
  });

  // Follow XDR mutation (blockchain transaction)
  const followXDR = api.fan.trx.followCreatorTRX.useMutation({
    onSuccess: async (xdr, variables) => {
      if (xdr) {
        if (xdr === true) {
          toast({
            title: "User already has trust in page asset",
            variant: "default",
          });
          follow.mutate({ creatorId: variables.creatorId });
        } else {
          try {
            const res = await clientsign({
              presignedxdr: xdr,
              pubkey: session.data?.user.id,
              walletType: session.data?.user.walletType,
              test: clientSelect(),
            });

            if (res) {
              follow.mutate({ creatorId: variables.creatorId });
            } else {
              toast({
                title: "Transaction failed while signing.",
                variant: "destructive",
              });
            }
          } catch (e) {
            toast({
              title: "Transaction failed while signing.",
              variant: "destructive",
            });
          }
        }
      } else {
        toast({
          title: "Transaction failed while signing.",
          variant: "destructive",
        });
      }
    },
    onError: (e) =>
      toast({
        title: "Transaction failed while signing.",
        variant: "destructive",
      }),
  });

  // Handle follow click
  const handleFollowClick = () => {
    followXDR.mutate({
      creatorId: creatorId,
      signWith: needSign(),
    });
  };

  // Handle unfollow click
  const handleUnfollowClick = () => {
    unFollow.mutate({ creatorId: creatorId });
  };

  const isLoading =
    followXDR.isLoading || follow.isLoading || unFollow.isLoading;

  return (
    <>
      {isFollowing ? (
        <Button
          onClick={handleUnfollowClick}
          variant="destructive"
          size={size}
          className={`shadow-sm shadow-foreground ${className}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {showText && <span>Loading...</span>}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <UserX className="h-4 w-4" />
              {showText && <span>Unfollow</span>}
            </div>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleFollowClick}
          variant={variant}
          size={size}
          className={`shadow-sm shadow-foreground ${className}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {showText && <span>Loading...</span>}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <UserRoundPlus className="h-4 w-4" />
              {showText && <span>Follow</span>}
            </div>
          )}
        </Button>
      )}
    </>
  );
}
