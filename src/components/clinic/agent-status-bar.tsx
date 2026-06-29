"use client";

interface AgentStatusBarProps {
  label: string;
}

export function AgentStatusBar({ label }: AgentStatusBarProps) {
  return (
    <div className="shrink-0 border-b border-green-100 bg-agent-bubble px-4 py-2">
      <p className="text-xs font-medium text-green-800 text-center truncate">{label}</p>
    </div>
  );
}
