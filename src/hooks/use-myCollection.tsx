import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { AssetType } from "~/types/market/market-asset-type";

export const useShowDisableButton = (data?: AssetType) => {
  const session = useSession();
  const router = useRouter();

  if (
    session.status === "authenticated" &&
    data?.creatorId === session.data.user.id
  ) {
    return true;
  }
  if (router.pathname === "/my-collection") {
    return true;
  }
  return false;
};
