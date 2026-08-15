import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Textarea } from "~/components/shadcn/ui/textarea";
import { Label } from "~/components/shadcn/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card";
import { Separator } from "~/components/shadcn/ui/separator";
import { Switch } from "~/components/shadcn/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import { Badge } from "~/components/shadcn/ui/badge";
import { LastFmIcon, SpotifyIcon } from "~/components/layout/Left-sidebar/icons";
import {
  Plus,
  X,
  Trophy,
  ExternalLink,
  Loader2,
  Sparkles,
  ArrowLeft,
  Info,
  ChevronRight,
  ListChecks,
  Wand2,
  Coins,
  ShieldCheck,
  Wallet,
  Building2,
  Users,
  Camera,
  Music,
  Radio,
  Search,
  Play,
  CheckCircle2,
  Headphones,
  Disc3,
  Youtube,
  SlidersHorizontal,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "~/utils/api";
import { PLATFORM_ASSET, PLATFORM_FEE, stellarExpertUrl } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import useNeedSign from "~/lib/hook";
import { clientsign, extractTxHash } from "package/connect_wallet";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { MarkdownEditor } from "~/components/bounty/markdown-editor";
import { BountyCard } from "~/components/bounty/bounty-card";
import { useUserStellarAcc, useCreatorStorageAcc, AccBalanceType } from "~/lib/state/wallete/stellar-balances";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { useBountyCreateStore } from "~/lib/state/bounty-create-store";
import { useDebounce } from "~/hooks/use-debounce";

const MAX_TITLE = 120;
const MAX_SUMMARY = 600;
const MAX_DESC = 6000;
const MAX_REWARD_NOTE = 600;
const MAX_INSTRUCTION = 200;

type AssetOption = {
  key: string; // unique key: "user:CODE:ISSUER" or "creator:CODE:ISSUER"
  code: string;
  issuer: string | null;
  balance: string;
  source: "user" | "creator";
  sourceLabel: string;
};

function isCreditBalance(b: AccBalanceType): b is Extract<AccBalanceType, { asset_code: string }> {
  return b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12";
}

// The escrow contract's `create_bounty`/`select_winner`/`cancel_bounty` calls
// authorize against whichever pubkey funded the bounty — either the user's
// own wallet, or (source: "creator") the Creator's custodial storage account,
// in which case the server signs every subsequent on-chain call for this
// bounty with the stored secret (see getEscrowCreatorIdentity server-side).
function balancesToOptions(
  balances: AccBalanceType[] | undefined,
  source: "user" | "creator",
): AssetOption[] {
  if (!balances) return [];
  const sourceLabel = source === "user" ? "User Wallet" : "Creator Wallet";
  const opts: AssetOption[] = [];

  for (const b of balances) {
    if (b.asset_type === "liquidity_pool_shares") continue;
    if (b.asset_type === "native") {
      opts.push({
        key: `${source}:XLM:native`,
        code: "XLM",
        issuer: null,
        balance: b.balance,
        source,
        sourceLabel,
      });
    } else if (isCreditBalance(b)) {
      opts.push({
        key: `${source}:${b.asset_code}:${b.asset_issuer}`,
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
        source,
        sourceLabel,
      });
    }
  }

  // Sort: PLATFORM_ASSET first, then by balance desc
  opts.sort((a, b) => {
    const aIsPlatform = a.code === PLATFORM_ASSET.code && a.issuer === PLATFORM_ASSET.issuer;
    const bIsPlatform = b.code === PLATFORM_ASSET.code && b.issuer === PLATFORM_ASSET.issuer;
    if (aIsPlatform && !bIsPlatform) return -1;
    if (!aIsPlatform && bIsPlatform) return 1;
    return parseFloat(b.balance) - parseFloat(a.balance);
  });

  return opts;
}

interface SampleTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  durationSec: number;
  lastFmUrl: string;
  defaultSpotifyUrl: string;
  defaultYoutubeUrl: string;
}

const SAMPLE_LASTFM_TRACKS: SampleTrack[] = [
  {
    id: "lfm-1",
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    albumArtUrl: "/images/logo.png",
    durationSec: 200,
    lastFmUrl: "https://www.last.fm/music/The+Weeknd/_/Blinding+Lights",
    defaultSpotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
    defaultYoutubeUrl: "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
  },
  {
    id: "lfm-2",
    title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    album: "Starboy",
    albumArtUrl: "/images/logo.png",
    durationSec: 230,
    lastFmUrl: "https://www.last.fm/music/The+Weeknd/_/Starboy",
    defaultSpotifyUrl: "https://open.spotify.com/track/7MXVkk9YMctZqd1Srtv4MB",
    defaultYoutubeUrl: "https://www.youtube.com/watch?v=34Na4j8AVgA",
  },
  {
    id: "lfm-3",
    title: "As It Was",
    artist: "Harry Styles",
    album: "Harry's House",
    albumArtUrl: "/images/logo.png",
    durationSec: 167,
    lastFmUrl: "https://www.last.fm/music/Harry+Styles/_/As+It+Was",
    defaultSpotifyUrl: "https://open.spotify.com/track/4DvkF65LpprmT1wF2Awe8t",
    defaultYoutubeUrl: "https://www.youtube.com/watch?v=H5v3kku4y6Q",
  },
  {
    id: "lfm-4",
    title: "Levitating",
    artist: "Dua Lipa",
    album: "Future Nostalgia",
    albumArtUrl: "/images/logo.png",
    durationSec: 203,
    lastFmUrl: "https://www.last.fm/music/Dua+Lipa/_/Levitating",
    defaultSpotifyUrl: "https://open.spotify.com/track/5nNmjkXiZ1DHBIJUZv3LgW",
    defaultYoutubeUrl: "https://www.youtube.com/watch?v=TUVcZfQe-Kw",
  },
  {
    id: "lfm-5",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    albumArtUrl: "/images/logo.png",
    durationSec: 243,
    lastFmUrl: "https://www.last.fm/music/M83/_/Midnight+City",
    defaultSpotifyUrl: "https://open.spotify.com/track/6GyFP1yDBEGF9xsAY0plOx",
    defaultYoutubeUrl: "https://www.youtube.com/watch?v=dX3k_QDnzHE",
  },
];

export default function CreateBountyPage() {
  const { needSign } = useNeedSign();
  const router = useRouter();
  const { data: session, status } = useSession();

  const userBalances = useUserStellarAcc((s) => s.balances);
  const creatorBalances = useCreatorStorageAcc((s) => s.balances);

  const userOptions = useMemo(() => balancesToOptions(userBalances, "user"), [userBalances]);
  const creatorOptions = useMemo(() => balancesToOptions(creatorBalances, "creator"), [creatorBalances]);
  const allOptions = useMemo(() => [...userOptions, ...creatorOptions], [userOptions, creatorOptions]);

  // Form State from Zustand Store (Persisted in memory across OAuth redirect)
  const store = useBountyCreateStore();
  const {
    title,
    summary,
    description,
    prizeAmount,
    rewardNote,
    maxWinners,
    instructions,
    selectedAssetKey,
    requiresActionCam,
    enableMusic,
    musicMode,
    ruleType,
    customRequiredTracks,
    customTotalPlays,
    selectedTracks,
    setField,
    resetForm,
  } = store;

  const setTitle = (val: string) => setField("title", val);
  const setSummary = (val: string) => setField("summary", val);
  const setDescription = (val: string) => setField("description", val);
  const setPrizeAmount = (val: string) => setField("prizeAmount", val);
  const setRewardNote = (val: string) => setField("rewardNote", val);
  const setMaxWinners = (val: string) => setField("maxWinners", val);
  const setInstructions = (val: string[] | ((prev: string[]) => string[])) => {
    if (typeof val === "function") {
      setField("instructions", val(instructions));
    } else {
      setField("instructions", val);
    }
  };
  const setSelectedAssetKey = (val: string) => setField("selectedAssetKey", val);
  const setRequiresActionCam = (val: boolean) => setField("requiresActionCam", val);
  const setEnableMusic = (val: boolean) => setField("enableMusic", val);
  const setMusicMode = (val: "MUSIC_ONLY" | "HYBRID") => setField("musicMode", val);
  const setRuleType = (val: "ALL" | "ANY_N" | "TOTAL_PLAYS") => setField("ruleType", val);
  const setCustomRequiredTracks = (val: number) => setField("customRequiredTracks", val);
  const setCustomTotalPlays = (val: number) => setField("customTotalPlays", val);
  const setSelectedTracks = (val: typeof selectedTracks | ((prev: typeof selectedTracks) => typeof selectedTracks)) => {
    if (typeof val === "function") {
      setField("selectedTracks", val(selectedTracks));
    } else {
      setField("selectedTracks", val);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [showCardPreview, setShowCardPreview] = useState(false);

  // Fetch real top 5 tracks for Three Years Hollow via Last.fm API
  const { data: realTopTracksData } =
    api.bounty.Bounty.getArtistTopTracks.useQuery(
      { artist: "Three Years Hollow" },
      { staleTime: 1000 * 60 * 30 }
    );

  const sampleTracks = useMemo(() => {
    if (realTopTracksData && realTopTracksData.length > 0) {
      return realTopTracksData.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        albumArtUrl: t.albumArtUrl,
        durationSec: t.durationSec,
        lastFmUrl: t.lastFmUrl,
        defaultSpotifyUrl: "",
        defaultYoutubeUrl: "",
      }));
    }
    return SAMPLE_LASTFM_TRACKS;
  }, [realTopTracksData]);

  // Fetch real Last.fm track search results (debounced 400ms)
  const { data: realSearchResults, isLoading: isSearchingTracks } =
    api.bounty.Bounty.searchLastFmTracks.useQuery(
      { query: debouncedSearchQuery },
      { enabled: debouncedSearchQuery.trim().length > 1 }
    );

  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    if (realSearchResults) {
      return realSearchResults.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        albumArtUrl: t.albumArtUrl,
        durationSec: t.durationSec,
        lastFmUrl: t.lastFmUrl,
        defaultSpotifyUrl: "",
        defaultYoutubeUrl: "",
      }));
    }
    return [];
  }, [debouncedSearchQuery, realSearchResults]);

  const addTrack = (track: SampleTrack) => {
    if (selectedTracks.some((t) => t.id === track.id)) {
      toast.error("Track already added to requirement list");
      return;
    }
    const newTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArtUrl: track.albumArtUrl,
      targetPlayCount: 3,
      targetDurationSec: track.durationSec,
      lastFmUrl: track.lastFmUrl,
      spotifyUrl: track.defaultSpotifyUrl,
      youtubeUrl: track.defaultYoutubeUrl,
    };
    setSelectedTracks((prev) => [...prev, newTrack]);
    setSearchQuery("");
    toast.success(`Added "${track.title}" to target rules`);
  };

  const removeTrack = (trackId: string) => {
    setSelectedTracks((prev) => prev.filter((t) => t.id !== trackId));
    toast.success("Track removed");
  };

  const updateTrackConfig = (
    trackId: string,
    field: keyof typeof selectedTracks[0],
    val: unknown
  ) => {
    setSelectedTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, [field]: val } : t))
    );
  };

  const [instructionInput, setInstructionInput] = useState("");
  const [draftAi, setDraftAi] = useState("");
  const [step, setStep] = useState<"form" | "paying" | "creating" | "done">("form");

  const lastFmAccountQ = api.bounty.Bounty.getMyLastFmAccount.useQuery(undefined, { enabled: Boolean(session) });
  const lastFmAccount = lastFmAccountQ.data;


  const selectedAsset = useMemo(
    () => allOptions.find((o) => o.key === selectedAssetKey) ?? null,
    [allOptions, selectedAssetKey],
  );

  // Auto-generated rule summary text shown under music rule strategy
  const computedRuleSummary = useMemo(() => {
    const count = selectedTracks.length;
    if (count === 0) return "Add tracks above to configure listening rules.";
    if (ruleType === "ALL")
      return `Participants must listen to ALL ${count} selected track${count > 1 ? "s" : ""} for their required target play counts.`;
    if (ruleType === "ANY_N") {
      const n = Math.min(customRequiredTracks, count);
      return `Participants must listen to any ${n} out of ${count} selected track${count > 1 ? "s" : ""} for their required target play counts.`;
    }
    if (ruleType === "TOTAL_PLAYS")
      return `Participants must accumulate at least ${customTotalPlays} total scrobbles across any of the ${count} selected tracks.`;
    return "Rule strategy configured.";
  }, [ruleType, customRequiredTracks, customTotalPlays, selectedTracks]);

  const prize = parseFloat(prizeAmount) || 0;
  const winners = Math.max(parseInt(maxWinners) || 1, 1);
  const perWinner = winners > 0 ? Math.floor(prize / winners) : 0;
  const remaining = selectedAsset ? parseFloat(selectedAsset.balance) - prize : null;
  const isInsufficient = remaining !== null && remaining < 0;

  useEffect(() => {
    if (status === "unauthenticated") void router.push("/");
  }, [status, router]);

  // Decode & restore draft form state from URL query state token if returning from OAuth
  useEffect(() => {
    if (router.query.draft && typeof router.query.draft === "string") {
      try {
        const decoded = JSON.parse(atob(decodeURIComponent(router.query.draft)));
        if (decoded.title) setTitle(decoded.title);
        if (decoded.summary) setSummary(decoded.summary);
        if (decoded.description) setDescription(decoded.description);
        if (decoded.prizeAmount) setPrizeAmount(decoded.prizeAmount);
        if (decoded.rewardNote) setRewardNote(decoded.rewardNote);
        if (decoded.maxWinners) setMaxWinners(decoded.maxWinners);
        if (Array.isArray(decoded.instructions)) setInstructions(decoded.instructions);
        if (decoded.selectedAssetKey) setSelectedAssetKey(decoded.selectedAssetKey);
        if (typeof decoded.requiresActionCam === "boolean") setRequiresActionCam(decoded.requiresActionCam);
        if (typeof decoded.enableMusic === "boolean") setEnableMusic(decoded.enableMusic);
        if (decoded.musicMode) setMusicMode(decoded.musicMode);
        if (decoded.ruleType) setRuleType(decoded.ruleType);
        if (decoded.customRequiredTracks) setCustomRequiredTracks(decoded.customRequiredTracks);
        if (decoded.customTotalPlays) setCustomTotalPlays(decoded.customTotalPlays);
        if (Array.isArray(decoded.selectedTracks)) setSelectedTracks(decoded.selectedTracks);
      } catch (e) {
        console.error("Error decoding draft from URL query:", e);
      }
    }
  }, [router.query.draft]);

  // Preselect bounty type from dropdown selection (?type=general|music)
  useEffect(() => {
    if (router.query.type === "music") setField("enableMusic", true);
    else if (router.query.type === "general") setField("enableMusic", false);
  }, [router.query.type, setField]);

  useEffect(() => {
    if (router.query.error === "api_key_missing") {
      toast.error("NEXT_PUBLIC_LASTFM_API_KEY is missing in your .env file!");
    } else if (router.query.error === "api_secret_missing" || router.query.error === "api_keys_missing") {
      toast.error("LASTFM_API_SECRET is missing in your .env file!");
    } else if (router.query.lastfm === "connected") {
      toast.success("Last.fm account connected successfully!");
    }
  }, [router.query]);

  // Flow: create the (unfunded) bounty row -> build the escrow-contract funding
  // XDR against its id -> sign & submit -> confirm on-chain success. If the
  // bounty is funded from the creator's storage account, the server signs the
  // funding call fully itself (fullySignedByServer) and no wallet popup is
  // needed; otherwise the owner signs with their own wallet via clientsign.
  const getXDRMutation = api.bounty.Bounty.getCreateBountyXDR.useMutation({
    onSuccess: async ({ xdr, fullySignedByServer }, variables) => {
      try {
        let submitted = false;
        let txHash: string | undefined;
        if (fullySignedByServer) {
          const result = await submitSignedXDRToServer4User(xdr);
          submitted = !!result;
          txHash = extractTxHash(result);
        } else {
          const clientResponse = await clientsign({
            presignedxdr: xdr,
            walletType: session?.user.walletType,
            pubkey: session?.user.id,
            test: clientSelect(),
          });
          submitted = !!clientResponse;
          txHash = extractTxHash(clientResponse);
        }

        if (!submitted || !txHash) {
          console.error("Funding transaction could not be confirmed", { submitted, txHash });
          toast.error("Funding transaction could not be confirmed.");
          await deleteBountyMutation.mutateAsync({ bountyId: variables.bountyId });
          setStep("form");
          return;
        }

        await confirmMutation.mutateAsync({ bountyId: variables.bountyId, txHash });
      } catch (e) {
        console.error("Funding transaction failed", e);
        toast.error("Funding transaction could not be confirmed.");
        await deleteBountyMutation.mutateAsync({ bountyId: variables.bountyId });
        setStep("form");
      }
    },
    onError: (e) => {
      toast.error(e.message);
      setStep("form");
    },
  });

  const createMutation = api.bounty.Bounty.createBounty.useMutation({
    onSuccess: async (bounty) => {
      try {
        await getXDRMutation.mutateAsync({
          bountyId: bounty.id,
          signWith: needSign(),
        });
      } catch {
        await deleteBountyMutation.mutateAsync({ bountyId: bounty.id })
      }
    },
    onError: (e) => {
      toast.error(e.message);
      setStep("form");
    },
  });

  const confirmMutation = api.bounty.Bounty.confirmBountyFunded.useMutation({
    onSuccess: (bounty) => {
      resetForm();
      setStep("done");
      toast.success("Bounty created!");
      void router.push(`/bounty/${bounty.id}`);
    },
    onError: (e) => {
      toast.error(e.message);
      setStep("form");
    },
  });

  const deleteBountyMutation = api.bounty.Bounty.deleteUnfundedBounty.useMutation();

  const disconnectLastFmM = api.bounty.Bounty.disconnectLastFmAccount.useMutation({
    onSuccess: () => {
      toast.success("Last.fm account disconnected");
      void lastFmAccountQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const draftMutation = api.bounty.Bounty.draftBounty.useMutation({
    onSuccess: (draft) => {
      if (draft.title) setTitle(draft.title);
      if (draft.summary) setSummary(draft.summary);
      if (draft.description) setDescription(draft.description);
      if (draft.prizeAmount > 0) setPrizeAmount(String(draft.prizeAmount));
      if (draft.maxWinners > 0) setMaxWinners(String(draft.maxWinners));
      if (draft.rewardNote) setRewardNote(draft.rewardNote);
      if (draft.instructions.length > 0) setInstructions(draft.instructions);
      toast.success("Draft generated — review and tweak as needed");
    },
    onError: (e) => {
      toast.error(e.message || "Could not generate draft");
    },
  });

  const addInstruction = () => {
    const trimmed = instructionInput.trim();
    if (!trimmed) return;
    if (instructions.length >= 10) {
      toast.error("Maximum 10 instructions");
      return;
    }
    setInstructions((prev) => [...prev, trimmed]);
    setInstructionInput("");
  };

  const removeInstruction = (i: number) => {
    setInstructions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const validate = () => {
    if (!title.trim()) return "Title is required";
    const p = parseFloat(prizeAmount);
    if (!prizeAmount || isNaN(p) || p <= 0) return "Prize must be greater than 0";
    const w = parseInt(maxWinners);
    if (!maxWinners || isNaN(w) || w < 1) return "At least 1 winner required";
    if (enableMusic && selectedTracks.length === 0) return "Add at least one track for the music challenge";
    if ((!enableMusic || musicMode === "HYBRID") && !instructions.length) return "Add at least one submission instruction";
    if (!selectedAsset) return "Select a reward asset";
    if (isInsufficient) return `Insufficient ${selectedAsset.code} balance`;
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!session?.user || !selectedAsset) return;

    setStep("paying");
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        prizeAmount: parseFloat(prizeAmount),
        rewardNote: rewardNote.trim() || undefined,
        maxWinners: parseInt(maxWinners),
        instructions: (!enableMusic || musicMode === "HYBRID") ? instructions : [],
        prizeAssetCode: selectedAsset.code,
        prizeAssetIssuer: selectedAsset.issuer,
        requiresActionCam,
        fromCreatorWallet: selectedAsset.source === "creator",
        enableMusic,
        musicConfig: enableMusic ? {
          musicMode,
          ruleType,
          customRequiredTracks: ruleType === "ANY_N" ? customRequiredTracks : undefined,
          customTotalPlays: ruleType === "TOTAL_PLAYS" ? customTotalPlays : undefined,
          tracks: selectedTracks.map((t) => ({
            title: t.title,
            artist: t.artist,
            album: t.album,
            albumArtUrl: t.albumArtUrl,
            durationSec: t.targetDurationSec,
            targetPlayCount: t.targetPlayCount,
            lastFmUrl: t.lastFmUrl,
            spotifyUrl: t.spotifyUrl,
            youtubeUrl: t.youtubeUrl,
          })),
        } : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setStep("form");
    }
  };

  const handleDraftAi = () => {
    const trimmed = draftAi.trim();
    if (trimmed.length < 5) {
      toast.error("Describe your bounty idea (at least a few words)");
      return;
    }
    draftMutation.mutate({ prompt: trimmed });
  };

  const isPaying = step === "paying";
  const isCreating = step === "creating";
  const isDisabled = isPaying || isCreating || step === "done";
  const isDrafting = draftMutation.isLoading;

  const titleLen = title.length;
  const summaryLen = summary.length;
  const rewardLen = rewardNote.length;

  const assetExpertUrl = selectedAsset
    ? stellarExpertUrl(selectedAsset.code, selectedAsset.issuer)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link href="/bounty" className="hover:text-foreground transition-colors">
              Bounties
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Create</span>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void router.push("/bounty")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Create Bounty
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Launch a challenge and reward the best submissions
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Draft with AI */}
            <Card className="border-border overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary/60" />
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Draft with AI
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                    GPT-5.4-mini
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Describe your bounty idea and we&apos;ll generate a complete draft — title, summary, description, prize, winners, reward note, and submission requirements — that you can edit before publishing.
                </p>
                <Textarea
                  value={draftAi}
                  onChange={(e) => setDraftAi(e.target.value)}
                  placeholder="e.g. A bounty for designers to create a futuristic landing page for our AI token launch. Want a hero section, tokenomics table, and roadmap. Reward top 3 submissions."
                  className="min-h-[90px] resize-none bg-secondary border-border"
                  disabled={isDisabled || isDrafting}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleDraftAi();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Tip: ⌘/Ctrl + Enter to generate
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDraftAi}
                    disabled={isDisabled || isDrafting || draftAi.trim().length < 5}
                  >
                    {isDrafting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-2" />
                    )}
                    {isDrafting ? "Generating…" : "Generate draft"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Basic Info */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-muted-foreground" />
                  Basic Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Title */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        titleLen > MAX_TITLE - 20 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {titleLen}/{MAX_TITLE}
                    </span>
                  </div>
                  <Input
                    value={title}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_TITLE) setTitle(e.target.value);
                    }}
                    placeholder="e.g. Build a landing page for our token launch"
                    className="bg-secondary border-border"
                    disabled={isDisabled}
                  />
                </div>

                {/* Summary */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Short Summary</Label>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        summaryLen > MAX_SUMMARY - 60 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {summaryLen}/{MAX_SUMMARY}
                    </span>
                  </div>
                  <Textarea
                    value={summary}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_SUMMARY) setSummary(e.target.value);
                    }}
                    placeholder="A brief one-liner that describes the bounty…"
                    className="min-h-[80px] resize-none bg-secondary border-border"
                    disabled={isDisabled}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Full Description</Label>
                    <span className="text-xs text-muted-foreground">Markdown supported</span>
                  </div>
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    disabled={isDisabled}
                    placeholder="Describe the bounty in detail. Use the toolbar to add headings, lists, links, code blocks, tables, and more…"
                    minHeight={320}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 🎵 Music & Streaming Challenge Card — only in Music Bounty mode */}
            {enableMusic && (
              <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Music className="h-4 w-4 text-purple-400" />
                    Music &amp; Streaming Challenge
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Automatically verify participant listening scrobbles via Last.fm API
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-3 border-t border-border/60">
                  {/* Last.fm Account Status */}
                  {!lastFmAccount ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                        <Radio className="h-4 w-4 animate-pulse text-red-500" />
                        Connect your Last.fm Creator Account
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        To create music bounties, connect your Last.fm account via OAuth so scrobbles can be verified.
                      </p>
                      <Button
                        size="sm"
                        className="font-bold text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5"
                        onClick={() => {
                          window.location.href = `/api/lastfm/auth?redirect=${encodeURIComponent(router.asPath)}`;
                        }}
                      >
                        <Radio className="h-3.5 w-3.5 text-white" />
                        Connect Last.fm Account
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>Connected as <strong className="font-mono text-foreground">@{lastFmAccount.username}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => disconnectLastFmM.mutate()}
                        disabled={disconnectLastFmM.isLoading}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wide transition-colors disabled:opacity-50"
                      >
                        {disconnectLastFmM.isLoading ? "Disconnecting…" : "Disconnect"}
                      </button>
                    </div>
                  )}

                  {/* Strategy Mode Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Requirement Strategy Mode</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMusicMode("HYBRID")}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all space-y-1",
                          musicMode === "HYBRID"
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-card/40 text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Music className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs font-bold text-foreground">Hybrid Strategy</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Require both Last.fm track scrobbles + standard submission reports.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMusicMode("MUSIC_ONLY")}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all space-y-1",
                          musicMode === "MUSIC_ONLY"
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-card/40 text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Radio className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs font-bold text-foreground">Pure Music Only</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Verification is 100% automated via Last.fm scrobble listening data.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Song Search & Picker */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-primary" />
                        Search &amp; Add Songs from Last.fm
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedTracks.length} / 5 tracks added
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search any song title or artist name on Last.fm..."
                        className="pl-9 pr-9 text-xs h-9 bg-secondary border-border"
                      />
                      {isSearchingTracks && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-purple-400" />
                      )}

                      {searchQuery.trim().length > 1 && (
                        <div className="absolute top-10 left-0 right-0 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden py-1 divide-y divide-border/40 max-h-72 overflow-y-auto">
                          {isSearchingTracks ? (
                            <div className="px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                              <span>Searching Last.fm live music database…</span>
                            </div>
                          ) : searchResults.length > 0 ? (
                            searchResults.map((track) => (
                              <div
                                key={track.id}
                                onClick={() => addTrack(track)}
                                className="px-3 py-2 hover:bg-muted/60 flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={track.albumArtUrl || "/images/logo.png"}
                                    alt={track.title}
                                    onError={(e) => { e.currentTarget.src = "/images/logo.png"; }}
                                    className="h-8 w-8 rounded object-cover shrink-0 border border-border"
                                  />
                                  <div className="truncate">
                                    <p className="text-xs font-bold text-foreground truncate">{track.title}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{track.artist} · {track.album}</p>
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0 text-primary">
                                  + Add
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                              No tracks found for &quot;{searchQuery}&quot; on Last.fm
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] font-semibold text-purple-400 mr-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Three Years Hollow Top 5 (Last.fm):
                      </span>
                      {sampleTracks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => addTrack(t)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:border-purple-500/60 hover:bg-purple-500/20 transition-all font-medium"
                        >
                          + {t.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Song Cards & Target Rules */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Headphones className="h-3.5 w-3.5 text-primary" />
                      Configure Track Listening Rules
                    </Label>

                    {selectedTracks.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs">
                        No tracks added yet. Search or quick-add songs above.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedTracks.map((track, idx) => (
                          <div
                            key={track.id}
                            className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3 hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-bold text-muted-foreground w-4 text-center">
                                  #{idx + 1}
                                </span>
                                <img
                                  src={track.albumArtUrl || "/images/logo.png"}
                                  alt={track.title}
                                  onError={(e) => { e.currentTarget.src = "/images/logo.png"; }}
                                  className="h-10 w-10 rounded-lg object-cover shrink-0 border border-border"
                                />
                                <div className="truncate">
                                  <h4 className="text-xs font-bold text-foreground truncate">{track.title}</h4>
                                  <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                                </div>
                              </div>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeTrack(track.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <Separator className="bg-border/50" />

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[11px] text-muted-foreground">
                                    Target Play Count (Scrobbles)
                                  </Label>
                                  {ruleType === "TOTAL_PLAYS" && (
                                    <span className="text-[9px] text-amber-400/90 font-medium">Sum Mode</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={track.targetPlayCount}
                                    onChange={(e) => updateTrackConfig(track.id, "targetPlayCount", parseInt(e.target.value) || 1)}
                                    className={cn("h-8 text-xs font-mono", ruleType === "TOTAL_PLAYS" && "opacity-60 bg-muted")}
                                    disabled={ruleType === "TOTAL_PLAYS"}
                                  />
                                  <span className="text-[11px] text-muted-foreground shrink-0">plays</span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Target Duration (Sec)</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="30"
                                    max="3600"
                                    value={track.targetDurationSec}
                                    onChange={(e) => updateTrackConfig(track.id, "targetDurationSec", parseInt(e.target.value) || 30)}
                                    className="h-8 text-xs font-mono"
                                  />
                                  <span className="text-[11px] text-muted-foreground shrink-0">sec</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5 pt-1">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <LastFmIcon className="h-3 w-3 text-red-500" />
                                  Last.fm URL
                                </Label>
                                <Input
                                  value={track.lastFmUrl}
                                  onChange={(e) => updateTrackConfig(track.id, "lastFmUrl", e.target.value)}
                                  placeholder="https://www.last.fm/music/..."
                                  className="h-7 text-[11px]"
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <SpotifyIcon className="h-3 w-3 text-emerald-500" />
                                  Spotify URL
                                </Label>
                                <Input
                                  value={track.spotifyUrl ?? ""}
                                  onChange={(e) => updateTrackConfig(track.id, "spotifyUrl", e.target.value)}
                                  placeholder="https://open.spotify.com/track/..."
                                  className="h-7 text-[11px]"
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Youtube className="h-3 w-3 text-red-500" />
                                  YouTube URL
                                </Label>
                                <Input
                                  value={track.youtubeUrl ?? ""}
                                  onChange={(e) => updateTrackConfig(track.id, "youtubeUrl", e.target.value)}
                                  placeholder="https://youtube.com/watch?v=..."
                                  className="h-7 text-[11px]"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customizable Global Rule Completion Strategy */}
                  <div className="space-y-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                        Customizable Global Listening Strategy
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                        Customizable
                      </Badge>
                    </div>

                    <Select value={ruleType} onValueChange={(v: unknown) => setRuleType(v as "ALL" | "ANY_N" | "TOTAL_PLAYS")}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-xs">
                          Must listen to ALL ({selectedTracks.length}) listed tracks
                        </SelectItem>
                        <SelectItem value="ANY_N" className="text-xs">
                          Must listen to ANY N tracks (Custom track count)
                        </SelectItem>
                        <SelectItem value="TOTAL_PLAYS" className="text-xs">
                          Accumulate N total plays across any tracks
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {ruleType === "ANY_N" && (
                      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">
                          Required Number of Songs to Complete
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max={Math.max(1, selectedTracks.length)}
                            value={customRequiredTracks}
                            onChange={(e) => setCustomRequiredTracks(parseInt(e.target.value) || 1)}
                            className="h-8 text-xs font-mono w-24"
                          />
                          <span className="text-[11px] text-muted-foreground">
                            out of {selectedTracks.length} tracks
                          </span>
                        </div>
                      </div>
                    )}

                    {ruleType === "TOTAL_PLAYS" && (
                      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-medium">
                          Required Total Play Count Across All Songs
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={customTotalPlays}
                            onChange={(e) => setCustomTotalPlays(parseInt(e.target.value) || 1)}
                            className="h-8 text-xs font-mono w-24"
                          />
                          <span className="text-[11px] text-muted-foreground">total plays</span>
                        </div>
                      </div>
                    )}

                    {/* Applied Rule Summary Banner */}
                    <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 flex items-start gap-2.5 text-xs pt-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-foreground">Applied Rule: </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {computedRuleSummary}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submission Requirements — hidden in Music Only mode */}
            {(!enableMusic || musicMode === "HYBRID") ? (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    Submission Requirements
                    {enableMusic && musicMode === "HYBRID" && (
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                        Hybrid Mode
                      </Badge>
                    )}
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {instructions.length}/10
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {enableMusic
                      ? "Participants must submit standard proof AND complete music listening goals."
                      : "Add instructions one by one. These will appear on the bounty cover page."}
                  </p>
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={instructionInput}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_INSTRUCTION) setInstructionInput(e.target.value);
                      }}
                      placeholder="e.g. Submit a GitHub repo link with working demo"
                      className="min-h-[60px] flex-1 resize-none bg-secondary border-border"
                      disabled={isDisabled}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          addInstruction();
                        }
                      }}
                    />
                    <Button
                      variant="default"
                      size="default"
                      className="h-10 shrink-0 px-4"
                      onClick={addInstruction}
                      disabled={isDisabled || !instructionInput.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add
                    </Button>
                  </div>
                  {instructions.length > 0 && (
                    <ul className="space-y-2">
                      {instructions.map((inst, i) => (
                        <li
                          key={i}
                          className="group flex items-start gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5 hover:border-primary/40 transition-colors"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold tabular-nums">
                            {i + 1}
                          </span>
                          <p className="flex-1 text-sm leading-relaxed break-words min-w-0">{inst}</p>
                          <button
                            onClick={() => removeInstruction(i)}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 -m-1"
                            disabled={isDisabled}
                            aria-label="Remove requirement"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {instructions.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-6 text-center">
                      <ListChecks className="h-7 w-7 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">
                        No requirements yet. Add at least one to continue.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-purple-500/20 bg-purple-500/5">
                <CardContent className="pt-4 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-purple-200 text-sm">
                    <Music className="h-4 w-4 text-purple-400" />
                    Music Only Mode Active
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Participants do not need to submit manual proof reports or text. Qualification is automated strictly via Last.fm scrobble verification.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Prizing + settings */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Reward card */}
              <Card className="border-border overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/40" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Reward
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Asset selector */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                      Reward Asset <span className="text-destructive">*</span>
                    </Label>

                    {allOptions.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-3 py-3 text-xs text-muted-foreground">
                        <Wallet className="h-4 w-4 shrink-0" />
                        Loading wallet balances…
                      </div>
                    ) : (
                      <Select
                        value={selectedAssetKey}
                        onValueChange={setSelectedAssetKey}
                        disabled={isDisabled}
                      >
                        <SelectTrigger className="bg-secondary border-border h-11 text-sm">
                          <SelectValue placeholder="Select asset">
                            {selectedAsset && (
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-foreground">{selectedAsset.code}</span>
                                <span className="text-muted-foreground text-xs truncate">
                                  {selectedAsset.source === "user" ? (
                                    <span className="inline-flex items-center gap-0.5">
                                      <Wallet className="h-2.5 w-2.5" /> User
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5">
                                      <Building2 className="h-2.5 w-2.5" /> Creator
                                    </span>
                                  )}
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                  {parseFloat(selectedAsset.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {userOptions.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Wallet className="h-3 w-3" /> User Wallet
                              </SelectLabel>
                              {userOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="font-medium">{opt.code}</span>
                                    {opt.issuer && (
                                      <span className="text-muted-foreground text-[10px] font-mono truncate max-w-[80px]">
                                        {opt.issuer.slice(0, 6)}…
                                      </span>
                                    )}
                                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                      {parseFloat(opt.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {creatorOptions.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Building2 className="h-3 w-3" /> Creator Wallet
                              </SelectLabel>
                              {creatorOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="font-medium">{opt.code}</span>
                                    {opt.issuer && (
                                      <span className="text-muted-foreground text-[10px] font-mono truncate max-w-[80px]">
                                        {opt.issuer.slice(0, 6)}…
                                      </span>
                                    )}
                                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                      {parseFloat(opt.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Stellar Expert link for selected asset */}
                    {selectedAsset && assetExpertUrl && (
                      <a
                        href={assetExpertUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        View {selectedAsset.code} on Stellar Expert
                      </a>
                    )}
                  </div>

                  {/* Prize amount + max winners — only shown after an asset is chosen */}
                  {selectedAsset && (
                    <>
                      {/* Total Prize Pool */}
                      <div className="space-y-1.5">
                        <Label>
                          Total Prize Pool <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="1"
                            max={Math.floor(parseFloat(selectedAsset.balance))}
                            value={prizeAmount}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") { setPrizeAmount(""); return; }
                              const num = parseFloat(raw);
                              const cap = parseFloat(selectedAsset.balance);
                              if (!isNaN(num) && num <= cap) setPrizeAmount(raw);
                            }}
                            placeholder="0"
                            className={cn(
                              "bg-secondary border-border pr-20 tabular-nums",
                              isInsufficient && "border-destructive/60",
                            )}
                            disabled={isDisabled}
                            autoFocus
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                            {selectedAsset.code}
                          </span>
                        </div>
                        {/* Remaining balance hint */}
                        {prizeAmount && (
                          <p className={cn(
                            "flex items-center gap-1 text-[11px] px-0.5",
                            isInsufficient ? "text-destructive" : "text-muted-foreground",
                          )}>
                            <Wallet className="h-2.5 w-2.5 shrink-0" />
                            {isInsufficient
                              ? <>Insufficient — balance is <strong className="tabular-nums">{parseFloat(selectedAsset.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> {selectedAsset.code}</>
                              : <>Remaining: <strong className="tabular-nums">{remaining!.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> {selectedAsset.code}</>
                            }
                          </p>
                        )}
                      </div>

                      {/* Number of Winners */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Label>
                            Number of Winners <span className="text-destructive">*</span>
                          </Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>How many people can win this bounty</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={maxWinners}
                          onChange={(e) => setMaxWinners(e.target.value)}
                          className="bg-secondary border-border tabular-nums"
                          disabled={isDisabled}
                        />
                      </div>

                      {/* Each winner receives — always visible once prize + winners set, uneditable */}
                      <div className="rounded-lg border border-border bg-secondary/60 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Trophy className="h-3.5 w-3.5 text-primary" />
                            Total Prize Pool
                          </span>
                          <span className={cn("font-semibold tabular-nums", isInsufficient ? "text-destructive" : "text-foreground")}>
                            {prize > 0 ? prize.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} {selectedAsset.code}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            Number of Winners
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">{winners}</span>
                        </div>
                        <div className="border-t border-border/60 pt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Coins className="h-3.5 w-3.5 text-primary" />
                            Each winner receives
                          </span>
                          <span className="text-sm font-bold text-primary tabular-nums">
                            {prize > 0 && winners > 0
                              ? (prize / winners).toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : "—"}{" "}
                            {selectedAsset.code}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator className="bg-border" />

                  {/* Action Cam verification toggle — hidden in Music Only mode */}
                  {(!enableMusic || musicMode === "HYBRID") && (
                    <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4 text-primary" />
                            <Label htmlFor="requiresActionCam" className="text-sm font-semibold">
                              Require Action Cam proof
                            </Label>
                            {enableMusic && musicMode === "HYBRID" && (
                              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                Hybrid Mode
                              </Badge>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    When on, participants must submit proof using Action Cam — a live
                                    camera capture stamped with time, location, and wallet, then
                                    cryptographically sealed by our server. You can turn this off at
                                    any time from the bounty settings.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {enableMusic
                              ? "Submissions must include cryptographically sealed live proof along with music listening goals."
                              : "Submitters open the in-app camera, capture live (no uploads), and the server signs the photo so edits are detectable. Off by default."}
                          </p>
                        </div>
                        <Switch
                          id="requiresActionCam"
                          checked={requiresActionCam}
                          onCheckedChange={setRequiresActionCam}
                          disabled={isDisabled}
                        />
                      </div>
                    </div>
                  )}

                  <Separator className="bg-border" />

                  {/* Reward delivery note */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label>How is the reward delivered?</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {rewardLen}/{MAX_REWARD_NOTE}
                      </span>
                    </div>
                    <Textarea
                      value={rewardNote}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_REWARD_NOTE) setRewardNote(e.target.value);
                      }}
                      placeholder="e.g. Prize sent directly to your Stellar wallet via ACTION token within 48 hours of winner selection…"
                      className="min-h-[80px] resize-none bg-secondary border-border"
                      disabled={isDisabled}
                    />
                  </div>

                  {/* Default-hidden Live Card Preview toggle when music is enabled */}
                  {enableMusic && (
                    <div className="pt-1 space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCardPreview(!showCardPreview)}
                        className="w-full text-xs font-semibold gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                      >
                        {showCardPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {showCardPreview ? "Hide Live Card Preview" : "Show Live Card Preview"}
                      </Button>

                      {showCardPreview && (
                        <div className="p-3 rounded-xl border border-purple-500/30 bg-card space-y-2">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                            Live Card Preview (Feed View)
                          </p>
                          <BountyCard
                            bounty={{
                              id: 0,
                              title: title || "Sample Music Bounty Title",
                              summary: summary || "Listen to target tracks on Last.fm to satisfy requirements and win rewards.",
                              prizeAmount: parseFloat(prizeAmount) || 100,
                              prizeAssetCode: selectedAsset?.code ?? "XLM",
                              maxWinners: parseInt(maxWinners) || 1,
                              enableMusic: true,
                              musicConfig: {
                                musicMode,
                                ruleType,
                                tracks: selectedTracks.map((t) => ({
                                  title: t.title,
                                  artist: t.artist,
                                  album: t.album,
                                  albumArtUrl: t.albumArtUrl,
                                })),
                              },
                              _count: { participants: 0, winners: 0 },
                              createdAt: new Date(),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Separator className="bg-border" />

                  {/* Payment source note */}
                  {selectedAsset && (
                    <div className="rounded-lg bg-accent/30 border border-accent/40 p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium text-accent-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Payment flow</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        The full prize amount will be sent from your{" "}
                        <strong>{selectedAsset.source === "creator" ? "creator storage wallet" : "user wallet"}</strong>{" "}
                        to our escrow wallet immediately. Winners claim their reward directly.
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCreate}
                    disabled={isDisabled || isInsufficient || !selectedAsset}
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing payment…
                      </>
                    ) : isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating bounty…
                      </>
                    ) : (
                      <>
                        <Trophy className="h-4 w-4 mr-2" />
                        Create &amp; Pay
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    You&apos;ll sign a Stellar transaction to fund the bounty
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
