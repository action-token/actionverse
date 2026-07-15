import { useState, useRef, useCallback } from "react";
import { MediaType } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/shadcn/ui/dialog";
import { Button } from "~/components/shadcn/ui/button";
import { Label } from "~/components/shadcn/ui/label";
import {
  X,
  Loader2,
  Send,
  ImageIcon,
  Video,
  Music,
  FileText,
  Paperclip,
  UploadCloud,
} from "lucide-react";
import { api } from "~/utils/api";
import toast from "react-hot-toast";
import axios from "axios";
import { cn } from "~/lib/utils";
import { MarkdownEditor } from "~/components/bounty/markdown-editor";

interface UploadedMedia {
  url: string;
  type: MediaType;
  fileName: string;
  previewUrl?: string;
}

interface SubmitReportDialogProps {
  bountyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_WORDS = 2000;

/* ── MIME type catalogue ─────────────────────────────────────────────────── */

const ACCEPTED_MIME_TYPES = [
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  // video
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // audio
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/alac",
  "audio/aiff",
  "audio/wma",
  "audio/m4a",
  "audio/x-wav",
  "audio/x-ms-wma",
  "audio/x-aiff",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-mp3",
  "audio/x-mpeg",
  "audio/x-ogg",
  "audio/x-aac",
  "audio/x-alac",
  // 3D models
  "application/octet-stream",
  // docs
  "application/pdf",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
  "text/tab-separated-values",
].join(",");

const ACCEPT_ATTR = [
  ".jpg,.jpeg,.png,.webp,.gif,.svg",
  ".mp4,.mov,.webm",
  ".mp3,.wav,.ogg,.aac,.flac,.m4a,.wma,.aif,.aiff",
  ".obj,.glb",
  ".pdf,.doc,.docx,.xls,.xlsx,.ods,.csv,.tsv,.txt",
].join(",");

type S3Endpoint =
  | "imageUploader"
  | "videoUploader"
  | "musicUploader"
  | "blobUploader";

function getEndpoint(file: File): S3Endpoint {
  if (file.type.startsWith("image/")) return "imageUploader";
  if (file.type.startsWith("video/")) return "videoUploader";
  if (file.type.startsWith("audio/")) return "musicUploader";
  return "blobUploader";
}

function getMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return MediaType.IMAGE;
  if (file.type.startsWith("video/")) return MediaType.VIDEO;
  if (file.type.startsWith("audio/")) return MediaType.MUSIC;
  return MediaType.DOCUMENT;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/* ── File icon helper (exported for reuse in the viewer) ─────────────────── */

export function fileTypeIcon(type: MediaType) {
  switch (type) {
    case MediaType.IMAGE:
      return <ImageIcon className="h-4 w-4" />;
    case MediaType.VIDEO:
      return <Video className="h-4 w-4" />;
    case MediaType.MUSIC:
      return <Music className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

/* ── Component ─────────────────────────────────────────────────────────────── */

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function SubmitReportDialog({
  bountyId,
  open,
  onClose,
  onSuccess,
}: SubmitReportDialogProps) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const getSignedURL = api.s3.getSignedURL.useMutation();

  const submitMutation = api.bounty.Bounty.submitReport.useMutation({
    onSuccess: () => {
      toast.success("Report submitted!");
      setContent("");
      setMedia([]);
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      for (const file of files) {
        try {
          const checksum = await computeSHA256(file);
          const endpoint = getEndpoint(file);
          const data = await getSignedURL.mutateAsync({
            fileSize: file.size,
            fileType: file.type || "application/octet-stream",
            checksum,
            endPoint: endpoint,
            fileName: file.name,
          });

          const res = await axios.put(data.uploadUrl, file, {
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
          });

          if (res.status === 200) {
            const previewUrl = file.type.startsWith("image/")
              ? URL.createObjectURL(file)
              : undefined;

            setMedia((prev) => [
              ...prev,
              {
                url: data.fileUrl,
                type: getMediaType(file),
                fileName: file.name,
                previewUrl,
              },
            ]);
            toast.success(`${file.name} uploaded`);
          }
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getSignedURL],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void handleFiles(files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    void handleFiles(files);
  };

  const removeMedia = (idx: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error("Please write your submission");
      return;
    }
    if (countWords(content) > MAX_WORDS) {
      toast.error(`Submission exceeds ${MAX_WORDS} word limit`);
      return;
    }
    submitMutation.mutate({
      bountyId,
      content: content.trim(),
      media: media.map((m) => ({
        url: m.url,
        type: m.type,
        fileName: m.fileName,
      })),
    });
  };

  const wordCount = countWords(content);
  const overLimit = wordCount > MAX_WORDS;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl w-full bg-card border-border p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Submit Report
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Submission label */}
          <div className="px-5 pt-3 pb-1.5">
            <Label>Your submission</Label>
          </div>

          {/* Open-source markdown editor with built-in toolbar + live preview */}
          <div className="px-5">
            <MarkdownEditor
              value={content}
              onChange={setContent}
              maxWords={MAX_WORDS}
              placeholder="Describe your work. Use the toolbar to add headings, lists, links, code, tables, and more — the bounty creator will see a formatted preview…"
              minHeight={260}
            />
          </div>

          {/* Attachments */}
          <div className="px-5 pb-4 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments
                <span className="text-[11px] font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {media.length} file{media.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Upload zone (click + drag-drop) */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              disabled={uploading}
              className={cn(
                "group w-full flex flex-col items-center justify-center gap-2 px-4 py-6",
                "rounded-xl border-2 border-dashed transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                dragOver
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary text-muted-foreground hover:text-foreground",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <UploadCloud
                  className={cn(
                    "h-7 w-7 transition-transform group-hover:-translate-y-0.5",
                    dragOver ? "text-primary" : "text-muted-foreground",
                  )}
                />
              )}
              <div className="text-center">
                <p className="text-sm font-semibold">
                  {uploading
                    ? "Uploading…"
                    : dragOver
                      ? "Drop files to attach"
                      : "Click to upload or drag & drop"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Images · video · audio · PDFs · docs · spreadsheets · text
                </p>
              </div>
            </button>

            {/* File list */}
            {media.length > 0 && (
              <ul className="space-y-1.5">
                {media.map((m, i) => (
                  <li
                    key={i}
                    className="group flex items-center gap-2.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs hover:border-primary/40 transition-colors"
                  >
                    {m.type === MediaType.IMAGE && m.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.previewUrl}
                        alt=""
                        className="h-7 w-7 rounded object-cover shrink-0"
                      />
                    ) : (
                      <span
                        className={cn(
                          "shrink-0 flex h-7 w-7 items-center justify-center rounded-md",
                          m.type === MediaType.IMAGE &&
                          "bg-blue-500/10 text-blue-400",
                          m.type === MediaType.VIDEO &&
                          "bg-purple-500/10 text-purple-400",
                          m.type === MediaType.MUSIC &&
                          "bg-pink-500/10 text-pink-400",
                          m.type === MediaType.DOCUMENT &&
                          "bg-amber-500/10 text-amber-400",
                        )}
                      >
                        {fileTypeIcon(m.type)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {m.fileName}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {m.type.toLowerCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeMedia(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 -m-1 rounded"
                      aria-label={`Remove ${m.fileName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fileRef}
              type="file"
              multiple
              accept={`${ACCEPTED_MIME_TYPES},${ACCEPT_ATTR}`}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border bg-secondary/40 gap-2">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitMutation.isLoading ||
              uploading ||
              !content.trim() ||
              overLimit
            }
            className="min-w-[140px]"
          >
            {submitMutation.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
