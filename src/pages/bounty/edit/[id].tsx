import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Textarea } from "~/components/shadcn/ui/textarea";
import { Label } from "~/components/shadcn/ui/label";
import { Badge } from "~/components/shadcn/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card";
import { Separator } from "~/components/shadcn/ui/separator";
import {
  Plus,
  X,
  Trophy,
  Loader2,
  ArrowLeft,
  Save,
  ChevronRight,
  ListChecks,
  Wand2,
  Lock,
  Users,
} from "lucide-react";
import { api } from "~/utils/api";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import { MarkdownEditor } from "~/components/bounty/markdown-editor";

const MAX_TITLE = 120;
const MAX_SUMMARY = 600;
const MAX_DESC = 6000;
const MAX_REWARD_NOTE = 600;
const MAX_INSTRUCTION = 200;

export default function EditBountyPage() {
  const router = useRouter();
  const id = parseInt(router.query.id as string);
  const { data: session, status } = useSession();

  /* form state */
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [maxWinners, setMaxWinners] = useState("1");
  const [instructions, setInstructions] = useState<string[]>([]);
  const [instructionInput, setInstructionInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  /* auth guard */
  useEffect(() => {
    if (status === "unauthenticated") void router.push("/");
  }, [status, router]);

  /* load bounty */
  const bountyQ = api.bounty.Bounty.getBounty.useQuery({ bountyId: id }, { enabled: !!id && !isNaN(id) });
  const bounty = bountyQ.data;
  const isOwner = session?.user?.id === bounty?.userId;

  /* redirect non-owners */
  useEffect(() => {
    if (bounty && session?.user && !isOwner) void router.push(`/bounty/${id}`);
  }, [bounty, session, isOwner, router, id]);

  /* pre-fill form once */
  useEffect(() => {
    if (bounty && !initialized) {
      setTitle(bounty.title);
      setSummary(bounty.summary ?? "");
      setDescription(bounty.description ?? "");
      setRewardNote(bounty.rewardNote ?? "");
      setMaxWinners(String(bounty.maxWinners));
      setInstructions(bounty.instructions ?? []);
      setInitialized(true);
    }
  }, [bounty, initialized]);

  const updateM = api.bounty.Bounty.updateBounty.useMutation({
    onSuccess: () => {
      toast.success("Bounty updated!");
      void router.push(`/bounty/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const addInstruction = () => {
    const t = instructionInput.trim();
    if (!t) return;
    if (instructions.length >= 10) {
      toast.error("Maximum 10 requirements");
      return;
    }
    setInstructions((p) => [...p, t]);
    setInstructionInput("");
  };

  const removeInstruction = (i: number) => {
    setInstructions((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!instructions.length) {
      toast.error("Add at least one requirement");
      return;
    }
    const winners = parseInt(maxWinners);
    if (isNaN(winners) || winners < 1) {
      toast.error("At least 1 winner required");
      return;
    }

    updateM.mutate({
      bountyId: id,
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      rewardNote: rewardNote.trim() || undefined,
      // maxWinners is locked at creation — cannot be changed post-launch.
      instructions,
    });
  };

  /* loading */
  if (bountyQ.isLoading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Bounty not found</p>
      </div>
    );
  }

  const isSaving = updateM.isLoading;
  const perWinner = parseInt(maxWinners) > 0
    ? Math.floor(bounty.prizeAmount / parseInt(maxWinners))
    : 0;

  const titleLen = title.length;
  const summaryLen = summary.length;
  const rewardLen = rewardNote.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link href="/bounty/joined" className="hover:text-foreground transition-colors">
              My Bounties
            </Link>
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => void router.push(`/bounty/${id}`)}
              className="hover:text-foreground transition-colors truncate max-w-[180px]"
            >
              {bounty.title}
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Edit</span>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => void router.push("/bounty")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Edit Bounty
              </h1>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {bounty.title}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main form */}
          <div className="lg:col-span-2 space-y-6">
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
                        titleLen > MAX_TITLE - 20
                          ? "text-destructive"
                          : "text-muted-foreground",
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
                    disabled={isSaving}
                  />
                </div>

                {/* Summary */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Short Summary</Label>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        summaryLen > MAX_SUMMARY - 60
                          ? "text-destructive"
                          : "text-muted-foreground",
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
                    disabled={isSaving}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Full Description</Label>
                    <span className="text-xs text-muted-foreground">
                      Markdown supported
                    </span>
                  </div>
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    disabled={isSaving}
                    placeholder="Describe the bounty in detail. Use the toolbar to add headings, lists, links, code blocks, tables, and more…"
                    minHeight={320}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  Requirements
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {instructions.length}/10
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  What participants must submit. These appear on the bounty cover.
                </p>

                <div className="flex gap-2 items-end">
                  <Textarea
                    value={instructionInput}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_INSTRUCTION)
                        setInstructionInput(e.target.value);
                    }}
                    placeholder="e.g. Submit a GitHub repo link with working demo"
                    className="min-h-[60px] flex-1 resize-none bg-secondary border-border"
                    disabled={isSaving}
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
                    disabled={isSaving || !instructionInput.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>

                {instructions.length > 0 ? (
                  <ul className="space-y-2">
                    {instructions.map((inst, i) => (
                      <li
                        key={i}
                        className="group flex items-start gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5 hover:border-primary/40 transition-colors"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold tabular-nums">
                          {i + 1}
                        </span>
                        <p className="flex-1 text-sm leading-relaxed break-words min-w-0">
                          {inst}
                        </p>
                        <button
                          onClick={() => removeInstruction(i)}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 -m-1"
                          disabled={isSaving}
                          aria-label="Remove requirement"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
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

          {/* Right: settings + save */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-6 space-y-6">
              <Card className="border-border overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/40" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Prize (read-only) */}
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">Prize Pool</Label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <Trophy className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {bounty.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
                      </span>
                      <Badge
                        variant="secondary"
                        className="ml-auto gap-1 text-[10px] font-normal"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Locked
                      </Badge>
                    </div>
                  </div>

                  {/* Max winners (locked) */}
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">Maximum Winners</Label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <Users className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {bounty.maxWinners}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {bounty.maxWinners > 1 ? "winners" : "winner"}
                      </span>
                      <Badge
                        variant="secondary"
                        className="ml-auto gap-1 text-[10px] font-normal"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Locked
                      </Badge>
                    </div>
                    {parseInt(maxWinners) > 1 && bounty.prizeAmount && (
                      <p className="text-xs text-muted-foreground">
                        ≈ {perWinner.toLocaleString()} {PLATFORM_ASSET.code} per winner
                      </p>
                    )}
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
                        if (e.target.value.length <= MAX_REWARD_NOTE)
                          setRewardNote(e.target.value);
                      }}
                      placeholder="e.g. Prize sent directly to your Stellar wallet within 48 hours…"
                      className="min-h-[80px] resize-none bg-secondary border-border"
                      disabled={isSaving}
                    />
                  </div>

                  <Separator className="bg-border" />

                  {/* Save */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => void router.push(`/bounty/${id}`)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
