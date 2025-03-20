import { getTailwindScreenSize } from "~/utils/clientUtils";
import { useMarketRightStore } from "~/lib/state/marketplace/right";
import { usePopUpState } from "~/lib/state/right-pop";
import { MarketType } from "@prisma/client";
import { MarketAssetType, useModal } from "~/lib/state/play/use-modal-store";
import AssetView from "./asset";
import BuyModal from "../modal/buy-asset-modal";
import React, { useState } from "react";
import { useBuyModalStore } from "../store/buy-modal-store";

function MarketAssetComponent({ item }: { item: MarketAssetType }) {
    const { asset } = item;
    const { setIsOpen, setData, isOpen, data } = useBuyModalStore()

    return (
        <div className=""
            onClick={() => {
                console.log("cliked")
                setIsOpen(true)
                setData(item)
            }}>

            <AssetView code={asset.name} thumbnail={asset.thumbnail}
                creatorId={asset.creatorId}
                price={item.price}
            />





        </div>
    );
}

export default MarketAssetComponent;
