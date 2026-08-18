"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import axios, { AxiosError } from "axios"
import { UploadCloud, Loader2, Check, AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"
import { api } from "~/utils/api"
import type { EndPointType } from "~/server/s3"

const ACCEPT: Record<Exclude<EndPointType, "svgUploader" | "multiBlobUploader" | "blobUploader">, Record<string, string[]>> = {
    imageUploader: { "image/jpeg": [], "image/png": [], "image/webp": [], "image/gif": [] },
    videoUploader: { "video/mp4": [], "video/webm": [] },
    musicUploader: {
        "audio/mpeg": [], "audio/mp3": [], "audio/wav": [], "audio/ogg": [],
        "audio/aac": [], "audio/flac": [], "audio/m4a": [],
    },
    profileUploader: { "image/jpeg": [], "image/png": [], "image/webp": [], "image/gif": [] },
    coverUploader: { "image/jpeg": [], "image/png": [], "image/webp": [], "image/gif": [] },
    modelUploader: { "model/obj": [".obj"], "model/gltf-binary": [".glb"] },
}

const computeSHA256 = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

type Status = "idle" | "uploading" | "success" | "error"

/**
 * Drag-and-drop upload for a locked-media row — same signed-URL upload
 * flow as `UploadS3Button` (`api.s3.getSignedURL` + a direct PUT), just
 * with a real dropzone instead of a plain button, since a creator
 * dropping in a handful of reward files benefits more from drag-and-drop
 * than a file-picker dialog per item. See VIP_TICKET_UNLOCK_PLAN.md §3.
 */
export function MediaDropzone({
    endpoint,
    onUploadComplete,
    label,
}: {
    endpoint: Exclude<EndPointType, "svgUploader" | "multiBlobUploader" | "blobUploader">
    onUploadComplete: (url: string) => void
    label: string
}) {
    const [status, setStatus] = useState<Status>("idle")
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState<string>();
    const getSignedURL = api.s3.getSignedURL.useMutation();

    const upload = useCallback(
        async (file: File) => {
            setStatus("uploading");
            setProgress(0);
            setFileName(file.name);
            try {
                const { uploadUrl, fileUrl } = await getSignedURL.mutateAsync({
                    fileSize: file.size,
                    fileType: file.type,
                    checksum: await computeSHA256(file),
                    endPoint: endpoint,
                    fileName: file.name,
                });
                await axios.put(uploadUrl, file, {
                    headers: { "Content-Type": file.type },
                    onUploadProgress: (e) => {
                        if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
                    },
                });
                setStatus("success");
                onUploadComplete(fileUrl);
            } catch (e) {
                setStatus("error");
                const message = e instanceof AxiosError ? e.message : e instanceof Error ? e.message : "Upload failed";
                console.error("MediaDropzone upload failed:", message);
            }
        },
        [endpoint, getSignedURL, onUploadComplete],
    );

    const onDrop = useCallback(
        (accepted: File[]) => {
            const file = accepted[0];
            if (file) void upload(file);
        },
        [upload],
    );

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: ACCEPT[endpoint],
        maxFiles: 1,
        disabled: status === "uploading",
    });

    return (
        <div
            {...getRootProps()}
            className={cn(
                "flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-colors",
                isDragActive && !isDragReject && "border-primary bg-primary/5",
                isDragReject && "border-destructive bg-destructive/5",
                !isDragActive && status === "idle" && "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/40",
                status === "success" && "border-green-500/40 bg-green-50 dark:bg-green-950/20",
                status === "error" && "border-destructive/40 bg-destructive/5",
            )}
        >
            <input {...getInputProps()} />
            {status === "uploading" && (
                <>
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{progress}% — {fileName}</span>
                </>
            )}
            {status === "success" && (
                <>
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="max-w-[90%] truncate text-xs text-green-700 dark:text-green-400">{fileName}</span>
                    <span className="text-[11px] text-muted-foreground">Drop again to replace</span>
                </>
            )}
            {status === "error" && (
                <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="text-xs text-destructive">Upload failed — try again</span>
                </>
            )}
            {status === "idle" && (
                <>
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        {isDragActive ? "Drop to upload" : label}
                    </span>
                </>
            )}
        </div>
    )
}
