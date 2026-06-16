import ReactMarkdown from "react-markdown";
import { cn } from "~/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
  /** Tighter margins for use inside truncated snippets. Defaults to false. */
  compact?: boolean;
}

/**
 * Renders user-authored markdown with project design tokens.
 *
 * Supports CommonMark: headings, paragraphs, bold/italic, lists,
 * links, inline code, code blocks, blockquotes, and horizontal rules.
 *
 * All element styles are sourced from globals.css semantic tokens so the
 * output matches the rest of the app in both light and dark modes.
 */
export function Markdown({ content, className, compact = false }: MarkdownProps) {
  return (
    <div
      className={cn(
        "markdown-body text-[15px] leading-relaxed text-foreground/90",
        // Compact mode = tighten all the block margins so a 3-line preview
        // doesn't waste vertical space on huge gaps between elements.
        compact && [
          "text-sm",
          "[&_h1]:!mt-2 [&_h1]:!mb-1 [&_h2]:!mt-2 [&_h2]:!mb-1",
          "[&_h3]:!mt-2 [&_h3]:!mb-1 [&_h4]:!mt-1.5 [&_h4]:!mb-1",
          "[&_p]:!my-1 [&_ul]:!my-1 [&_ol]:!my-1",
          "[&_blockquote]:!my-2 [&_hr]:!my-3",
        ],
        className,
      )}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-foreground mt-6 mb-3 first:mt-0 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mt-5 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mt-4 mb-2 first:mt-0">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0 uppercase tracking-wide">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold text-muted-foreground mt-3 mb-1.5 first:mt-0 uppercase tracking-widest">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="my-3 first:mt-0 last:mb-0 text-foreground/90">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/90">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-3 ml-5 list-disc space-y-1.5 marker:text-primary/60">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-5 list-decimal space-y-1.5 marker:text-muted-foreground marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 break-words"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-primary/40 bg-primary/5 pl-4 pr-3 py-2 rounded-r-md text-foreground/80 italic">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClass, children, ...rest }) => {
            const isBlock =
              typeof codeClass === "string" && codeClass.includes("language-");
            if (isBlock) {
              return (
                <code
                  className={cn(
                    "block bg-secondary border border-border rounded-lg p-3 my-3 text-sm font-mono overflow-x-auto whitespace-pre",
                    codeClass,
                  )}
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[13px] font-mono text-primary"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          hr: () => <hr className="my-6 border-border" />,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt ?? ""}
              className="my-4 rounded-lg border border-border max-w-full h-auto"
              loading="lazy"
            />
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/60 border-b border-border">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 font-semibold text-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-border/60 text-foreground/90">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
