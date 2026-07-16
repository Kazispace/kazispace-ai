"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Shared GFM Markdown renderer for Clinic bubbles + CV preview.
 * KAZI-225: guide-style headings + bordered scrollable tables (Research MVP).
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "markdown-body min-w-0 max-w-full text-[15px] leading-relaxed",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-1 text-lg font-bold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-3 text-base font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-[15px] font-semibold first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          // TODO(dark-mode): table grays are light-theme only; swap to tokens when Clinic supports dark.
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[16rem] border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 text-left">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-gray-100 last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-gray-700">{children}</th>
          ),
          td: ({ children }) => (
            <td className="break-words px-3 py-2 align-top text-gray-800">
              {children}
            </td>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = codeClass?.includes("language-");
            if (isBlock) {
              return (
                <code className="my-2 block overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-orange-50 px-1 text-sm text-kazi-orange">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-kazi-orange underline underline-offset-2 hover:text-kazi-orange/80"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
