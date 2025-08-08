"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { Button } from "~/components/shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import { useModal } from "~/lib/state/augmented-reality/useModal";
import { useBounty } from "~/lib/state/augmented-reality/useBounty";
import { JoinBounty } from "~/lib/augmented-reality/join-bounty";
import { MapPin, Navigation } from 'lucide-react';
import { useLocation } from "~/hooks/use-location";

import { BountyTypeIndicator } from "~/components/bounty/bounty-type-indicator";
import { isWithinRadius } from "~/utils/location";
import { getUserPlatformAsset } from "~/lib/augmented-reality/get-user-platformAsset";

const JoinBountyModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "JoinBounty";
  const router = useRouter();
  const { setData } = useBounty();
  const queryClient = useQueryClient();
  const balanceRes = useQuery({
    queryKey: ["balance"],
    queryFn: getUserPlatformAsset,
  })
  // Add location hook
  const { location, loading: locationLoading, requestLocation } = useLocation();

  const handleClose = () => {
    onClose();
  };

  const JoinMutation = useMutation({
    mutationFn: async ({ bountyId }: { bountyId: number }) => {
      return await JoinBounty({ bountyId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["bounties"],
      });
      setData({ item: data.bounty });
      onClose();
      router.push(`/augmented-reality/actions/${data.bounty?.id}`);
    },
    onError: () => {
      toast.error("Failed to join bounty");
    },
  });

  const handleJoin = (bountyId: number) => {
    JoinMutation.mutate({ bountyId });
  };

  const { bounty, balance } = data;

  if (!bounty) {
    return (
      <Dialog open={isModalOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Bounty?</DialogTitle>
            <DialogDescription>
              Do you want to join this bounty? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <p className="text-center text-red-500">
            Bounty not found or has been removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Check location requirements
  const canJoinLocationBased = () => {
    if (bounty.bountyType !== "LOCATION_BASED") return true;

    if (!location || !bounty.latitude || !bounty.longitude) return false;
    console.log("Checking location:", {
      userLat: location.latitude,
      userLon: location.longitude,
    });
    return isWithinRadius(
      location.latitude,
      location.longitude,
      bounty.latitude,
      bounty.longitude,
      bounty.radius || 200
    );
  };

  const hasRequiredBalance = bounty.requiredBalance <= (balanceRes.data ?? 0);
  const canJoin = hasRequiredBalance && canJoinLocationBased();

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Join Bounty?
              <BountyTypeIndicator bountyType={bounty.bountyType} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Do you want to join this bounty? This action cannot be undone.
            </p>

            <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-4">
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{bounty?.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Required Balance: {bounty.requiredBalance} tokens
              </p>
            </div>

            {/* Balance Check */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <span className="text-sm font-medium">Balance Check:</span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${hasRequiredBalance ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${hasRequiredBalance ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {hasRequiredBalance ? 'Sufficient' : 'Insufficient'}
                </span>
              </div>
            </div>

            {/* Location Check for Location-based Bounties */}
            {bounty.bountyType === "LOCATION_BASED" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Location Check:</span>
                  </div>
                  {!location ? (
                    <Button
                      size="sm"
                      onClick={requestLocation}
                      disabled={locationLoading}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      {locationLoading ? "Getting..." : "Get Location"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${canJoinLocationBased() ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm font-medium ${canJoinLocationBased() ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {canJoinLocationBased() ? 'Within Range' : 'Too Far'}
                      </span>
                    </div>
                  )}
                </div>

                {location && !canJoinLocationBased() && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    You must be within 500 meters of the bounty location to join.
                  </p>
                )}
              </div>
            )}

            {/* Scavenger Hunt Info */}
            {bounty.bountyType === "SCAVENGER_HUNT" && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Scavenger Hunt</span>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Complete {bounty.ActionLocation?.length || 0} steps to win this bounty. Your progress will be tracked.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleJoin(Number(bounty.id))}
              disabled={!canJoin || JoinMutation.isLoading}
            >
              {JoinMutation.isLoading ? "Joining..." : "Join"}
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default JoinBountyModal;
