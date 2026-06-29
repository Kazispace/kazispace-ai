"use client";

interface QuickRepliesProps {
  options: string[];
  disabled?: boolean;
  onSelect: (text: string) => void;
}

export function QuickReplies({ options, disabled, onSelect }: QuickRepliesProps) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2 bg-gray-bg">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-kazi-orange hover:text-kazi-orange transition-colors disabled:opacity-50"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
