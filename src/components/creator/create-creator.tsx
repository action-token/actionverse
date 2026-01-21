import { Creator } from "@prisma/client";
import { type Session } from "next-auth";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { clientsign } from "package/connect_wallet";
import { useState } from "react";
import toast from "react-hot-toast";

import { Coins, DollarSign, Loader } from "lucide-react";
import { Label } from "~/components/shadcn/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/shadcn/ui/radio-group";

import { Button } from "~/components/shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn/ui/dialog";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
// import { PaymentMethod, PaymentMethodEnum } from "~/components/BuyItem";
import { api } from "~/utils/api";
import useNeedSign from "~/lib/hook";
import { CREATOR_TERM } from "~/utils/term";
import { PaymentMethod, PaymentMethodEnum } from "../payment/payment-process";
import { clientSelect } from "~/lib/stellar/fan/utils";
import Link from "next/link";

export function CreateStorage() {

  return (
    <Link href={"/organization/profile"}>
      <Button >
        Join as an Organization
      </Button>
    </Link>
  );
}
