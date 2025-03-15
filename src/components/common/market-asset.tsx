import { MarketAssetType, useModal } from "~/lib/state/play/use-modal-store";
import AssetView from "./asset";
import React from "react";
import { useBuyModalStore } from "../store/buy-modal-store";

function MarketAssetComponent({ item }: { item: MarketAssetType }) {
  const { asset } = item;
  const { setIsOpen, setData, isOpen, data } = useBuyModalStore();

  return (
    <div
      className=""
      onClick={() => {
        console.log("cliked");
        setIsOpen(true);
        setData(item);
      }}
    >
      <AssetView code={asset.name} thumbnail={asset.thumbnail} />
    </div>
  );
}

export default MarketAssetComponent;
