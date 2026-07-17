"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { splitMarkdownSources } from "@/lib/clinic/markdown-sources";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-1 text-lg font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1 mt-2.5 text-base font-semibold first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-[15px] font-semibold first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-1.5 list-disc space-y-0.5 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  // TODO(dark-mode): table grays are light-theme only; swap to tokens when Clinic supports dark.
  table: ({ children }) => (
    <div className="my-1.5 max-w-full overflow-x-auto rounded-lg border border-gray-200">
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
    <th className="px-2.5 py-1.5 font-semibold text-gray-700">{children}</th>
  ),
  td: ({ children }) => (
    <td className="break-words px-2.5 py-1.5 align-top text-gray-800">
      {children}
    </td>
  ),
  code: ({ className: codeClass, children }) => {
    const isBlock = codeClass?.includes("language-");
    if (isBlock) {
      return (
        <code className="my-1.5 block overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
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
  pre: ({ children }) => <pre className="my-1.5">{children}</pre>,
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
};

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

/**
 * Shared GFM Markdown renderer for Clinic bubbles + CV preview.
 * KAZI-225: guide-style headings + tables.
 * Research quality v3 P2: tighter spacing + collapsed「信息来源」block.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const { body, sourcesBody, sourcesSummary } = splitMarkdownSources(content);

  return (
    <div
      className={cn(
        "markdown-body min-w-0 max-w-full text-[15px] leading-snug",
        className
      )}
    >
      <MarkdownBody content={body} />
      {sourcesBody && sourcesSummary ? (
        <details className="group mt-2 rounded-lg border border-gray-200 bg-gray-50/80 open:bg-white">
          <summary className="cursor-pointer select-none list-none px-2.5 py-1.5 text-sm text-gray-600 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block text-gray-400 transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              <span>{sourcesSummary}</span>
            </span>
          </summary>
          <div className="border-t border-gray-100 px-2.5 py-1.5 text-sm [&_ul]:mb-0 [&_li]:leading-snug">
            <MarkdownBody content={sourcesBody} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
