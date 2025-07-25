import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircuitBoardIcon,
  Command,
  CreditCard,
  File,
  FileText,
  HelpCircle,
  Image,
  Laptop,
  LayoutDashboardIcon,
  Loader2,
  LogIn,
  LucideIcon,
  LucideProps,
  Moon,
  MoreVertical,
  Pizza,
  Plus,
  Settings,
  SunMedium,
  Trash,
  Twitter,
  HandCoins,
  User,
  User2Icon,
  UserX2Icon,
  X,
  Cable,
  Power,
  History,
  Wallet,
  ScrollText,
  Music,
  Store,
  Trophy,
  MapPinned,
  QrCode

} from "lucide-react";
import { RiAdminFill } from "react-icons/ri";
import { FaWallet } from "react-icons/fa";
import { RiNftFill } from "react-icons/ri";
import { MdMusicNote } from "react-icons/md";
import { FaMapPin } from "react-icons/fa";
import { BsCollectionFill } from "react-icons/bs";

export type Icon = LucideIcon;
import { SiSpringCreators } from "react-icons/si";

export const Icons = {
  dashboard: LayoutDashboardIcon,
  collection: ScrollText,
  reward: HandCoins,
  store: Store,
  setting: Settings,
  gitHub: ({ ...props }: LucideProps) => (
    <svg
      aria-hidden="true"
      focusable="false"
      data-prefix="fab"
      data-icon="github"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 496 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"
      ></path>
    </svg>
  ),
  twitter: Twitter,
  check: Check,
  admin: RiAdminFill,
  wallet: FaWallet,
  nft: RiNftFill,
  pins: FaMapPin,
  report: BsCollectionFill,
  creator: SiSpringCreators,
  users: User2Icon,
  bounty: Trophy,
  music: Music,
  map: MapPinned,
  qr: QrCode,
  artist: ({ ...props }: LucideProps) => (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_86_1027)">
        <mask id="mask0_86_1027" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
          <path d="M16 0H0V16H16V0Z" fill="currentColor" />
        </mask>
        <g >
          <path d="M8 6.66675C9.10457 6.66675 10 5.77132 10 4.66675C10 3.56218 9.10457 2.66675 8 2.66675C6.89543 2.66675 6 3.56218 6 4.66675C6 5.77132 6.89543 6.66675 8 6.66675Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12.0001 13.3334C12.7365 13.3334 13.3334 12.7365 13.3334 12.0001C13.3334 11.2637 12.7365 10.6667 12.0001 10.6667C11.2637 10.6667 10.6667 11.2637 10.6667 12.0001C10.6667 12.7365 11.2637 13.3334 12.0001 13.3334Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.22768 13.3335H4.00008C3.2637 13.3335 2.66675 12.7366 2.66675 12.0002C2.66675 10.5274 3.86065 9.3335 5.33341 9.3335H9.01861" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.3335 12.0002V7.3335L14.6668 8.66683" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <defs>
        <clipPath id="clip0_86_1027">
          <rect width="16" height="16" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>

  ),

};
