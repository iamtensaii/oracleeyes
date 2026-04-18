"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 text-[15px] leading-relaxed last:mb-0 sm:text-[15px]">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-4">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-semibold tracking-tight first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold tracking-tight first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="text-muted-foreground my-2 border-l-2 border-border pl-3 italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-border my-4" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary font-medium underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const text = String(children ?? "");
    const isBlock = Boolean(className?.includes("language-")) || text.includes("\n");
    if (!isBlock) {
      return (
        <code className="bg-muted/80 text-foreground rounded px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
      );
    }
    return (
      <pre className="border-border/60 bg-muted/40 my-2 overflow-x-auto rounded-xl border p-3 font-mono text-xs leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    );
  },
};

type ChatMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Renders assistant/user markdown safely (bold, lists, links, fenced code).
 */
export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  if (!content.trim()) return null;
  return (
    <div className={cn("min-w-0 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
