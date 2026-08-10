import { useState, useEffect, useMemo } from "react";
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
import { Switch } from "~/components/shadcn/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import {
  Plus,
  X,
  Trophy,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Save,
  ChevronRight,
  ListChecks,
  Wand2,
  Lock,
  Users,
  Camera,
  Music,
  Trash2,
  Search,
  CheckCircle2,
  Headphones,
  Radio,
  Disc3,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "~/utils/api";
import { PLATFORM_ASSET, stellarExpertUrl } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import { MarkdownEditor } from "~/components/bounty/markdown-editor";
import { LastFmIcon, SpotifyIcon } from "~/components/layout/Left-sidebar/icons";
import { useDebounce } from "~/hooks/use-debounce";

const MAX_TITLE = 120;
const MAX_SUMMARY = 600;
const MAX_DESC = 6000;
const MAX_REWARD_NOTE = 600;
const MAX_INSTRUCTION = 200;

type TrackItem = {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  targetPlayCount: number;
  targetDurationSec: number;
  lastFmUrl: string;
  spotifyUrl: string;
  youtubeUrl: string;
};

export default function EditBountyPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: session, status } = useSession();

  /* form state */
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [maxWinners, setMaxWinners] = useState("1");
  const [instructions, setInstructions] = useState<string[]>([]);
  const [instructionInput, setInstructionInput] = useState("");
  const [requiresActionCam, setRequiresActionCam] = useState(false);
  const [initialized, setInitialized] = useState(false);

  /* music state */
  const [enableMusic, setEnableMusic] = useState(false);
  const [musicMode, setMusicMode] = useState<"MUSIC_ONLY" | "HYBRID">("HYBRID");
  const [ruleType, setRuleType] = useState<"ALL" | "ANY_N" | "TOTAL_PLAYS">("ALL");
  const [customRequiredTracks, setCustomRequiredTracks] = useState(1);
  const [customTotalPlays, setCustomTotalPlays] = useState(10);
  const [selectedTracks, setSelectedTracks] = useState<TrackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);

  /* auth guard */
  useEffect(() => {
    if (status === "unauthenticated") void router.push("/");
  }, [status, router]);

  /* load bounty */
  const bountyQ = api.bounty.Bounty.getBounty.useQuery({ bountyId: id }, { enabled: !!id });
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
      setRequiresActionCam(bounty.requiresActionCam ?? false);
      setEnableMusic(bounty.enableMusic ?? false);
      setMusicMode((bounty.musicConfig?.musicMode) ?? "HYBRID");
      setRuleType((bounty.musicConfig?.ruleType) ?? "ALL");
      setCustomRequiredTracks(bounty.musicConfig?.customRequiredTracks ?? 1);
      setCustomTotalPlays(bounty.musicConfig?.customTotalPlays ?? 10);
      if (bounty.musicConfig?.tracks) {
        setSelectedTracks(
          bounty.musicConfig.tracks.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album ?? "",
            albumArtUrl: t.albumArtUrl ?? "",
            targetPlayCount: t.targetPlayCount,
            targetDurationSec: t.durationSec ?? 180,
            lastFmUrl: t.lastFmUrl,
            spotifyUrl: t.spotifyUrl ?? "",
            youtubeUrl: t.youtubeUrl ?? "",
          }))
        );
      }
      setInitialized(true);
    }
  }, [bounty, initialized]);

  /* Last.fm search */
  const searchQ = api.bounty.Bounty.searchLastFmTracks.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 2 }
  );

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

  const addTrack = (track: typeof searchQ.data extends (infer T)[] | undefined ? T : never) => {
    if (!track) return;
    if (selectedTracks.some((t) => t.id === track.id)) {
      toast.error("Track already added");
      return;
    }
    setSelectedTracks((p) => [
      ...p,
      {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album ?? "",
        albumArtUrl: track.albumArtUrl ?? "",
        targetPlayCount: 1,
        targetDurationSec: 180,
        lastFmUrl: track.lastFmUrl,
        spotifyUrl: "",
        youtubeUrl: "",
      },
    ]);
    setSearchQuery("");
  };

  const removeTrack = (idx: number) => {
    setSelectedTracks((p) => p.filter((_, i) => i !== idx));
  };

  const updateTrackConfig = (idx: number, field: string, value: number) => {
    setSelectedTracks((p) =>
      p.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );
  };

  const computedRuleSummary = useMemo(() => {
    const count = selectedTracks.length;
    if (count === 0) return "Add tracks to configure listening rules.";
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

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (enableMusic && selectedTracks.length === 0) {
      toast.error("Add at least one track for the music challenge");
      return;
    }
    if (!enableMusic && !instructions.length) {
      toast.error("Add at least one requirement");
      return;
    }

    updateM.mutate({
      bountyId: id,
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      rewardNote: rewardNote.trim() || undefined,
      instructions: enableMusic && musicMode === "MUSIC_ONLY" ? [] : instructions,
      requiresActionCam,
      enableMusic,
      musicConfig:
        enableMusic && selectedTracks.length > 0
          ? {
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
          }
          : undefined,
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

  const prizeAssetCode = bounty.prizeAssetCode ?? PLATFORM_ASSET.code;
  const prizeAssetIssuer = bounty.prizeAssetIssuer ?? PLATFORM_ASSET.issuer;
  const prizeExpertUrl = stellarExpertUrl(prizeAssetCode, prizeAssetIssuer);

  const titleLen = title.length;
  const summaryLen = summary.length;
  const rewardLen = rewardNote.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
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
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void router.push("/bounty")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Edit Bounty
              </h1>
              <p className="text-sm text-muted-foreground mt-1 truncate">{bounty.title}</p>
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
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Title <span className="text-destructive">*</span></Label>
                    <span className={cn("text-xs tabular-nums", titleLen > MAX_TITLE - 20 ? "text-destructive" : "text-muted-foreground")}>
                      {titleLen}/{MAX_TITLE}
                    </span>
                  </div>
                  <Input
                    value={title}
                    onChange={(e) => { if (e.target.value.length <= MAX_TITLE) setTitle(e.target.value); }}
                    placeholder="e.g. Build a landing page for our token launch"
                    className="bg-secondary border-border"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Short Summary</Label>
                    <span className={cn("text-xs tabular-nums", summaryLen > MAX_SUMMARY - 60 ? "text-destructive" : "text-muted-foreground")}>
                      {summaryLen}/{MAX_SUMMARY}
                    </span>
                  </div>
                  <Textarea
                    value={summary}
                    onChange={(e) => { if (e.target.value.length <= MAX_SUMMARY) setSummary(e.target.value); }}
                    placeholder="A brief one-liner that describes the bounty…"
                    className="min-h-[80px] resize-none bg-secondary border-border"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label>Full Description</Label>
                    <span className="text-xs text-muted-foreground">Markdown supported</span>
                  </div>
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    disabled={isSaving}
                    placeholder="Describe the bounty in detail…"
                    minHeight={320}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Music & Streaming Challenge */}
            <Card className={cn("border-border overflow-hidden", enableMusic ? "border-primary/40 shadow-sm" : "")}>
              <div className={cn("h-1 w-full", enableMusic ? "bg-gradient-to-r from-purple-500 to-primary" : "bg-gradient-to-r from-border to-border/50")} />
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Music className="h-4 w-4 text-muted-foreground" />
                  Music & Streaming Challenge
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    <Lock className="h-2.5 w-2.5 mr-1" />
                    Optional
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Enable Music Integration</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically verify participant listening scrobbles via Last.fm API
                    </p>
                  </div>
                  <Switch checked={enableMusic} onCheckedChange={setEnableMusic} disabled={isSaving} />
                </div>

                {enableMusic && (
                  <>
                    <Separator />

                    {/* Music Mode */}
                    <div className="space-y-2">
                      <Label className="text-sm">Music Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMusicMode("HYBRID")}
                          disabled={isSaving}
                          className={cn(
                            "rounded-xl border p-3 text-left transition-all",
                            musicMode === "HYBRID"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Hybrid</span>
                            {musicMode === "HYBRID" && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">Listen + Submit Report</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMusicMode("MUSIC_ONLY")}
                          disabled={isSaving}
                          className={cn(
                            "rounded-xl border p-3 text-left transition-all",
                            musicMode === "MUSIC_ONLY"
                              ? "border-purple-500 bg-purple-500/5 ring-1 ring-purple-500/40"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Music Only</span>
                            {musicMode === "MUSIC_ONLY" && <CheckCircle2 className="h-4 w-4 text-purple-400 ml-auto" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">Pure Listening Challenge</p>
                        </button>
                      </div>
                    </div>

                    {/* Track Search */}
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        Search Tracks on Last.fm
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search any song title or artist name…"
                          className="pl-9 bg-secondary border-border"
                          disabled={isSaving}
                        />
                      </div>
                      {searchQuery.length >= 2 && searchQ.isLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Searching Last.fm…
                        </div>
                      )}
                      {searchQ.data && searchQ.data.length > 0 && (
                        <div className="rounded-xl border border-border bg-card max-h-48 overflow-y-auto">
                          {searchQ.data.map((track) => (
                            <button
                              key={track.id}
                              onClick={() => addTrack(track)}
                              disabled={isSaving || selectedTracks.some((t) => t.id === track.id)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/60 transition-colors text-left border-b border-border/40 last:border-0 disabled:opacity-50"
                            >
                              {track.albumArtUrl ? (
                                <img src={track.albumArtUrl} alt="" className="h-8 w-8 rounded-lg object-cover border border-border shrink-0" />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                                  <Music className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">{track.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                              </div>
                              {selectedTracks.some((t) => t.id === track.id) ? (
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              ) : (
                                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Tracks */}
                    {selectedTracks.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Selected Tracks ({selectedTracks.length})</Label>
                        <div className="space-y-2">
                          {selectedTracks.map((track, idx) => (
                            <div key={track.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                              <div className="flex items-center gap-3">
                                {track.albumArtUrl ? (
                                  <img src={track.albumArtUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                                    <Music className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold truncate">{track.title}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                                </div>
                                <button
                                  onClick={() => removeTrack(idx)}
                                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                                  disabled={isSaving}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2.5 pt-2 mt-2 border-t border-border/30">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Target Plays</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={track.targetPlayCount}
                                    onChange={(e) => updateTrackConfig(idx, "targetPlayCount", parseInt(e.target.value) || 1)}
                                    className="h-8 text-xs font-mono"
                                    disabled={isSaving}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Duration</Label>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="30"
                                      max="3600"
                                      value={track.targetDurationSec}
                                      onChange={(e) => updateTrackConfig(idx, "targetDurationSec", parseInt(e.target.value) || 30)}
                                      className="h-8 text-xs font-mono"
                                      disabled={isSaving}
                                    />
                                    <span className="text-[10px] text-muted-foreground">sec</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Platforms</Label>
                                  <div className="flex items-center gap-1.5 h-8">
                                    {track.lastFmUrl && <LastFmIcon className="h-4 w-4 text-primary" />}
                                    {track.spotifyUrl && <SpotifyIcon className="h-4 w-4 text-green-500" />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Global Listening Rule */}
                    {selectedTracks.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          Global Listening Rule
                          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                            Customizable
                          </Badge>
                        </Label>
                        <Select value={ruleType} onValueChange={(v: unknown) => setRuleType(v as "ALL" | "ANY_N" | "TOTAL_PLAYS")} disabled={isSaving}>
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL" className="text-xs">Must listen to ALL ({selectedTracks.length}) listed tracks</SelectItem>
                            <SelectItem value="ANY_N" className="text-xs">Must listen to ANY N tracks (Custom track count)</SelectItem>
                            <SelectItem value="TOTAL_PLAYS" className="text-xs">Accumulate N total plays across any tracks</SelectItem>
                          </SelectContent>
                        </Select>

                        {ruleType === "ANY_N" && (
                          <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground font-medium">Required Number of Songs to Complete</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                max={selectedTracks.length}
                                value={customRequiredTracks}
                                onChange={(e) => setCustomRequiredTracks(parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono w-20"
                                disabled={isSaving}
                              />
                              <span className="text-[11px] text-muted-foreground">of {selectedTracks.length} tracks</span>
                            </div>
                          </div>
                        )}

                        {ruleType === "TOTAL_PLAYS" && (
                          <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground font-medium">Total Required Plays</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={customTotalPlays}
                                onChange={(e) => setCustomTotalPlays(parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono w-20"
                                disabled={isSaving}
                              />
                              <span className="text-[11px] text-muted-foreground">total plays</span>
                            </div>
                          </div>
                        )}

                        <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 flex items-start gap-2.5 text-xs">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-foreground">Applied Rule: </span>
                            <span className="text-muted-foreground leading-relaxed">{computedRuleSummary}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Submission Requirements — hidden in Music Only mode */}
            {(!enableMusic || musicMode === "HYBRID") && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    Requirements
                    {enableMusic && musicMode === "HYBRID" && (
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                        Hybrid Mode
                      </Badge>
                    )}
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{instructions.length}/10</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {enableMusic ? "Participants must submit standard proof AND complete music listening goals." : "What participants must submit."}
                  </p>
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={instructionInput}
                      onChange={(e) => { if (e.target.value.length <= MAX_INSTRUCTION) setInstructionInput(e.target.value); }}
                      placeholder="e.g. Submit a GitHub repo link with working demo"
                      className="min-h-[60px] flex-1 resize-none bg-secondary border-border"
                      disabled={isSaving}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addInstruction(); } }}
                    />
                    <Button variant="default" size="default" className="h-10 shrink-0 px-4" onClick={addInstruction} disabled={isSaving || !instructionInput.trim()}>
                      <Plus className="h-4 w-4 mr-1.5" /> Add
                    </Button>
                  </div>
                  {instructions.length > 0 ? (
                    <ul className="space-y-2">
                      {instructions.map((inst, i) => (
                        <li key={i} className="group flex items-start gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5 hover:border-primary/40 transition-colors">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold tabular-nums">{i + 1}</span>
                          <p className="flex-1 text-sm leading-relaxed break-words min-w-0">{inst}</p>
                          <button onClick={() => removeInstruction(i)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 -m-1" disabled={isSaving} aria-label="Remove requirement">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-6 text-center">
                      <ListChecks className="h-7 w-7 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">No requirements yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {enableMusic && musicMode === "MUSIC_ONLY" && (
              <Card className="border-purple-500/20 bg-purple-500/5">
                <CardContent className="pt-4 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-purple-200 text-sm">
                    <Music className="h-4 w-4 text-purple-400" />
                    Music Only Mode Active
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Participants do not submit manual proof. Qualification is automated via Last.fm scrobble verification.
                  </p>
                </CardContent>
              </Card>
            )}
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
                  {/* Prize (locked) */}
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">Prize Pool</Label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <Trophy className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold text-primary tabular-nums">{bounty.prizeAmount.toLocaleString()}</span>
                      <a href={prizeExpertUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary/80 hover:text-primary transition-colors">
                        {prizeAssetCode}
                        <ExternalLink className="h-3 w-3 ml-0.5" />
                      </a>
                      <Badge variant="secondary" className="ml-auto gap-1 text-[10px] font-normal">
                        <Lock className="h-2.5 w-2.5" /> Locked
                      </Badge>
                    </div>
                  </div>

                  {/* Max winners (locked) */}
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">Maximum Winners</Label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <Users className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold text-primary tabular-nums">{bounty.maxWinners}</span>
                      <span className="text-xs text-muted-foreground">{bounty.maxWinners > 1 ? "winners" : "winner"}</span>
                      <Badge variant="secondary" className="ml-auto gap-1 text-[10px] font-normal">
                        <Lock className="h-2.5 w-2.5" /> Locked
                      </Badge>
                    </div>
                    {parseInt(maxWinners) > 1 && bounty.prizeAmount && (
                      <p className="text-xs text-muted-foreground">≈ {perWinner.toLocaleString()} {prizeAssetCode} per winner</p>
                    )}
                  </div>

                  <Separator className="bg-border" />

                  {/* Action Cam */}
                  <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          <Label htmlFor="requiresActionCam" className="text-sm font-semibold">Action Cam proof</Label>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Require submitters to use Action Cam — live capture, stamped with time/location/wallet, cryptographically sealed.
                        </p>
                      </div>
                      <Switch id="requiresActionCam" checked={requiresActionCam} onCheckedChange={setRequiresActionCam} disabled={isSaving} />
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Reward note */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label>How is the reward delivered?</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{rewardLen}/{MAX_REWARD_NOTE}</span>
                    </div>
                    <Textarea
                      value={rewardNote}
                      onChange={(e) => { if (e.target.value.length <= MAX_REWARD_NOTE) setRewardNote(e.target.value); }}
                      placeholder="e.g. Prize sent directly to your Stellar wallet within 48 hours…"
                      className="min-h-[80px] resize-none bg-secondary border-border"
                      disabled={isSaving}
                    />
                  </div>

                  <Separator className="bg-border" />

                  <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                    )}
                  </Button>

                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => void router.push(`/bounty/${id}`)} disabled={isSaving}>
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
