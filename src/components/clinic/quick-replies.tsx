"use client";

import { cn } from "@/lib/utils";

interface QuickRepliesProps {
  options: string[];
  disabled?: boolean;
  onSelect: (text: string) => void;
  theme?: "default" | "workspace";
}

export function QuickReplies({ options, disabled, onSelect, theme = "default" }: QuickRepliesProps) {
  if (options.length === 0) return null;

  const isWorkspace = theme === "workspace";

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 px-3 pb-2",
        isWorkspace ? "bg-workspace-bg" : "bg-gray-bg"
      )}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded border transition-colors disabled:opacity-50",
            isWorkspace
              ? "border-workspace-border bg-white text-workspace-text hover:border-primary hover:text-primary hover:bg-workspace-active"
              : "border-gray-200 bg-white hover:border-primary hover:text-primary"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
