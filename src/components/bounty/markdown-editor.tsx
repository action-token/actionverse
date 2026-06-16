import dynamic from "next/dynamic";
import { useMemo, useRef, useEffect, useState } from "react";
import type { MDEditorProps } from "@uiw/react-md-editor";
import { commands as defaultCommands } from "@uiw/react-md-editor";
import { cn } from "~/lib/utils";
import { Markdown } from "~/components/bounty/markdown";

// NOTE: Global CSS for the editor (the library's markdown-editor.css plus
// our project overrides) is loaded from pages/_app.tsx — Next.js doesn't
// allow Global CSS imports from arbitrary component files.

/**
 * Lazy-load MDEditor to avoid SSR issues (it touches `document`).
 *
 * `next/dynamic` with `ssr: false` keeps it client-only.
 */
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-lg border border-border bg-secondary animate-pulse" />
    ),
  },
);

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  /** Soft word limit — counter turns yellow under this remaining, red when exceeded. */
  maxWords?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
}

/** Count words by splitting on whitespace. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Curated, text-only command set. The default MDEditor toolbar includes
 * image upload, fullscreen, help, and issue-tracker shortcuts that we
 * don't want — this list keeps the formatting basics.
 *
 * The editor is locked into "live" mode (textarea + live preview pane),
 * so the edit/live/preview mode switcher buttons are not included.
 *
 * The visual order groups related commands:
 *   text style  : bold · italic · strikethrough · inline code
 *   structure   : quote · list · link · table
 */
const TEXT_COMMANDS: MDEditorProps["commands"] = [
  defaultCommands.bold,
  defaultCommands.italic,
  defaultCommands.strikethrough,
  defaultCommands.code,
  defaultCommands.divider,
  defaultCommands.quote,
  defaultCommands.unorderedListCommand,
  defaultCommands.orderedListCommand,
  defaultCommands.checkedListCommand,
  defaultCommands.divider,
  defaultCommands.link,
  defaultCommands.table,
];

export function MarkdownEditor({
  value,
  onChange,
  maxWords,
  disabled,
  placeholder = "Write your content in Markdown…",
  className,
  minHeight = 280,
}: MarkdownEditorProps) {
  // Word count for soft / hard limits
  const wordCount = useMemo(() => countWords(value), [value]);
  const overLimit = maxWords !== undefined && wordCount > maxWords;

  // Track if the counter should flash / change color
  const remaining =
    maxWords !== undefined ? maxWords - wordCount : undefined;
  const isWarning = remaining !== undefined && remaining < 100;

  // Keep latest onChange in a ref so the dynamic editor's stable identity
  // doesn't cause re-renders on every keystroke.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Local mirror so the counter can show even while the parent debounces
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (next?: string) => {
    const v = next ?? "";
    setLocalValue(v);
    onChangeRef.current(v);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          // The `mdx-editor` class scopes all the CSS overrides in
          // ./markdown-editor.css so they only affect this component.
          "mdx-editor",
          // No outer border or ring — any visible line reads as a hard
          // black edge against the dark page background. The toolbar's
          // own border-bottom against the textarea bg is enough visual
          // structure.
          "rounded-lg overflow-hidden bg-secondary",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        <MDEditor
          value={localValue}
          onChange={handleChange}
          height={minHeight}
          minHeight={minHeight}
          maxHeight={
            typeof window !== "undefined"
              ? Math.round(window.innerHeight * 0.6)
              : 600
          }
          preview="live"
          // Curated text-only command set (no images, no help, etc.)
          commands={TEXT_COMMANDS}
          // Preview uses our project Markdown component for design consistency.
          components={{
            preview: (source) => (
              <div className="markdown-body px-4 py-3">
                <Markdown content={source} />
              </div>
            ),
          }}
          // Force dark mode so the library picks its GitHub-dark tokens.
          data-color-mode="dark"
          // No drag handle (would clash with the dialog scroll).
          visibleDragbar={false}
          textareaProps={{
            placeholder,
            disabled,
          }}
        />
      </div>

      {/* Word counter */}
      {maxWords !== undefined && (
        <div
          className={cn(
            "flex items-center justify-between text-xs px-1",
            overLimit
              ? "text-destructive"
              : isWarning
                ? "text-yellow-400"
                : "text-muted-foreground",
          )}
        >
          <span className="tabular-nums font-medium">
            {wordCount} / {maxWords} words
            {overLimit && <span className="ml-1.5">· over limit</span>}
          </span>
        </div>
      )}
    </div>
  );
}
