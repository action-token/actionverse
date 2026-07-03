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
} from "lucide-react";
import { api } from "~/utils/api";
import { PLATFORM_ASSET, PLATFORM_FEE, stellarExpertUrl } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import useNeedSign from "~/lib/hook";
import { clientsign } from "package/connect_wallet";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { MarkdownEditor } from "~/components/bounty/markdown-editor";
import { useUserStellarAcc, useCreatorStorageAcc, AccBalanceType } from "~/lib/state/wallete/stellar-balances";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";

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

export default function CreateBountyPage() {
  const { needSign } = useNeedSign();
  const router = useRouter();
  const { data: session, status } = useSession();

  const userBalances = useUserStellarAcc((s) => s.balances);
  const creatorBalances = useCreatorStorageAcc((s) => s.balances);

  const userOptions = useMemo(() => balancesToOptions(userBalances, "user"), [userBalances]);
  const creatorOptions = useMemo(() => balancesToOptions(creatorBalances, "creator"), [creatorBalances]);
  const allOptions = useMemo(() => [...userOptions, ...creatorOptions], [userOptions, creatorOptions]);

  // form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [maxWinners, setMaxWinners] = useState("1");
  const [instructions, setInstructions] = useState<string[]>([]);
  const [instructionInput, setInstructionInput] = useState("");
  const [draftAi, setDraftAi] = useState("");
  const [step, setStep] = useState<"form" | "paying" | "creating" | "done">("form");
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>("");
  const [requiresActionCam, setRequiresActionCam] = useState(false);


  const selectedAsset = useMemo(
    () => allOptions.find((o) => o.key === selectedAssetKey) ?? null,
    [allOptions, selectedAssetKey],
  );

  const prize = parseFloat(prizeAmount) || 0;
  const winners = Math.max(parseInt(maxWinners) || 1, 1);
  const perWinner = winners > 0 ? Math.floor(prize / winners) : 0;
  const remaining = selectedAsset ? parseFloat(selectedAsset.balance) - prize : null;
  const isInsufficient = remaining !== null && remaining < 0;

  useEffect(() => {
    if (status === "unauthenticated") void router.push("/");
  }, [status, router]);

  const getXDRMutation = api.bounty.Bounty.getCreateBountyXDR.useMutation({
    onSuccess: async ({ xdr, fullySignedByServer }, variables) => {
      if (!xdr) return;

      let submitted = false;
      if (fullySignedByServer) {
        await submitSignedXDRToServer4User(xdr);
        submitted = true;
      } else {
        const clientResponse = await clientsign({
          presignedxdr: xdr,
          walletType: session?.user.walletType,
          pubkey: session?.user.id,
          test: clientSelect(),
        });
        submitted = !!clientResponse;
      }

      if (submitted && selectedAsset) {
        await createMutation.mutateAsync({
          title: title.trim(),
          summary: summary.trim(),
          description: description.trim(),
          prizeAmount: variables.prize,
          rewardNote: rewardNote.trim() || undefined,
          maxWinners: parseInt(maxWinners),
          instructions,
          prizeAssetCode: selectedAsset.code,
          prizeAssetIssuer: selectedAsset.issuer,
          requiresActionCam,
        });
      }
    },
    onError: (e) => {
      toast.error(e.message);
      setStep("form");
    },
  });

  const createMutation = api.bounty.Bounty.createBounty.useMutation({
    onSuccess: (bounty) => {
      setStep("done");
      toast.success("Bounty created!");
      void router.push(`/bounty/${bounty.id}`);
    },
    onError: (e) => {
      toast.error(e.message);
      setStep("form");
    },
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
    if (!instructions.length) return "Add at least one submission instruction";
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
      await getXDRMutation.mutateAsync({
        prize: parseFloat(prizeAmount),
        signWith: needSign(),
        assetCode: selectedAsset.code === "XLM" ? "" : selectedAsset.code,
        assetIssuer: selectedAsset.issuer,
        fromCreatorWallet: selectedAsset.source === "creator",
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

            {/* Submission Requirements */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  Submission Requirements
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {instructions.length}/10
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Add instructions one by one. These will appear on the bounty cover page.
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

                  {/* Action Cam verification toggle */}
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-primary" />
                          <Label htmlFor="requiresActionCam" className="text-sm font-semibold">
                            Require Action Cam proof
                          </Label>
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
                          Submitters open the in-app camera, capture live (no uploads), and the server
                          signs the photo so edits are detectable. Off by default.
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
