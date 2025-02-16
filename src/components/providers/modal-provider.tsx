"use client";
import { useEffect, useState } from "react";
import BuyModal from "../modal/buy-asset-modal";
import ViewAdminAsset from "../modal/view-admin-asset";
import AssetInfoModal from "../modal/asset-info-modal";
import CollectedPinInfoModal from "../modal/pin-info-modal";
import MusicBuyModal from "../modal/music-buy-modal";
import EditBountyModal from "../modal/edit-bounty-modal";
import BountyFileUploadModal from "../modal/bounty-submission-modal";
import ViewBountyAttachmentModal from "../modal/view-bounty-attachment-modal";

const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <BuyModal />
      <ViewAdminAsset />
      <AssetInfoModal />
      <CollectedPinInfoModal />
      <MusicBuyModal />
      <EditBountyModal />
      <BountyFileUploadModal />
      <ViewBountyAttachmentModal />

    </>
  );
};

export default ModalProvider;
