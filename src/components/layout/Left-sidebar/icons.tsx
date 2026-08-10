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
  QrCode,
  Home,
  ArrowLeft,
  ImageIcon,
  ScanLine,
  Users2,
  Ticket,
  Send

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
  ticket: Ticket,
  check: Check,
  admin: RiAdminFill,
  wallet: FaWallet,
  nft: RiNftFill,
  pins: FaMapPin,
  report: BsCollectionFill,
  creator: SiSpringCreators,
  users: User2Icon,
  bounty: Trophy,
  telegram: Send,
  music: Music,
  map: MapPinned,
  qr: QrCode,
  home: Home,
  back: ArrowLeft,
  create: Plus,
  gallery: ImageIcon,
  scan: ScanLine,
  community: Users2,
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
  lastfm: LastFmIcon,
  spotify: SpotifyIcon,
};

export function LastFmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.584 17.21l-.88-2.393s-1.43 1.6-3.573 1.6c-1.897 0-3.244-1.65-3.244-4.29 0-3.38 1.704-4.59 3.38-4.59 2.41 0 3.17 1.562 3.83 3.565l.88 2.75C12.1 17.1 13.96 19 17.26 19c3.63 0 6.098-2.805 6.098-6.457 0-3.486-1.98-6.458-5.27-6.458-3.22 0-4.86 2.53-4.86 2.53l1.46 1.988s1.195-1.87 3.26-1.87c1.8 0 2.97 1.673 2.97 3.894 0 2.19-1.1 3.62-2.97 3.62-1.84 0-2.886-1.23-3.41-2.99l-.905-2.858C13.127 7.7 11.5 5.5 8.03 5.5 4.29 5.5 2 8.48 2 12.125c0 3.514 1.9 6.78 5.93 6.78 2.37 0 3.57-.97 3.57-.97z" />
    </svg>
  );
}

export function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
