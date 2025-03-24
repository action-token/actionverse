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
import CreateBountyModal from "../modal/create-bounty-modal";
import CreatorCreatePinModal from "../modal/creator-create-pin-modal";
import MapOptionModal from "../modal/map-options-modal";
import CreateAlbumModal from "../modal/create-album-modal";
import NftCreateModal from "../modal/nft-create-modal";
import CreatorStoredAssetModal from "../modal/creator-stored-asset-modal";
import CreateSongModal from "../modal/create-song-modal";
import ShareModal from "../modal/share-post-modal";
import CreateLocationBasedBountyModal from "../modal/create-locationbased-bounty";
import { CreatePostModal } from "../modal/create-post-modal";
import AddSubscriptionModal from "../modal/add-subscription-modal";

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
      <CreateBountyModal />
      <MapOptionModal />
      <CreatorCreatePinModal />
      <CreateAlbumModal />
      <NftCreateModal />
      <CreatorStoredAssetModal />
      <CreateSongModal />
      <ShareModal />
      <CreateLocationBasedBountyModal />
      <CreatePostModal />
      <AddSubscriptionModal />

    </>
  );
};

export default ModalProvider;
