import { useEffect, useState } from "react";
import ArQrSelectionModal from "~/components/modal/augmented-reality/ArQrSelectionModal";
import DeleteCollectionModal from "~/components/modal/augmented-reality/Delete-Collection-Modal";
import JoinBountyModal from "~/components/modal/augmented-reality/Join-Bounty-Modal";
import LocationInformationModal from "~/components/modal/augmented-reality/Location-Info-Modal";
import NearbyPinModal from "~/components/modal/augmented-reality/NearBy-Pin-Modal";


const ARModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <JoinBountyModal />
      <DeleteCollectionModal />
      <LocationInformationModal />
      <NearbyPinModal />
      <ArQrSelectionModal />
    </>
  );
};

export default ARModalProvider;
