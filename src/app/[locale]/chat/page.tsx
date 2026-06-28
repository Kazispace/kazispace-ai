"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWebUserId, getSessionId, getTelegramUser } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface ChatPageProps {
  params: { locale: string };
}

export default function ChatPage({ params }: ChatPageProps) {
  const t = useTranslations("chat");
  const tNav = useTranslations("nav");
  const { locale } = params;
  
  const [messages, setMessages] = useState<Array<{role: string; content: string; intent?: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tgUser = getTelegramUser();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkHealth();
    loadHistory();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch("https://bot.kazispace.ai/health", {
        signal: AbortSignal.timeout(5000)
      });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    }
  };

  const loadHistory = async () => {
    const sessionId = getSessionId();
    try {
      const history = await apiClient.getChatHistory(sessionId);
      if (history && history.length > 0) {
        setMessages(history.map(m => ({
          role: m.role,
          content: m.content,
        })));
      }
    } catch {}
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (text: string) => {
    const webUserId = getWebUserId();
    const sessionId = getSessionId();
    
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const response = await apiClient.sendChatMessage(webUserId, sessionId, text);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.reply,
        intent: response.intent,
      }]);
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, something went wrong. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: "📄 Build my CV", text: "Build my CV" },
    { label: "✏️ Improve my resume", text: "Help me improve my resume" },
    { label: "🇰🇿 Jobs in Kazakhstan", text: "What jobs are in demand in Kazakhstan?" },
    { label: "🎯 Interview tips", text: "How do I prepare for a job interview?" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-kazi-navy px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href={`/${locale}`} className="text-white">
          <span className="text-xl font-bold">
            <span className="text-kazi-orange">Kazi</span>Space
          </span>
        </Link>
        <div className="w-px h-6 bg-white/20" />
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kazi-orange to-amber-500 flex items-center justify-center text-lg">
            🤖
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{t("title")}</div>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")} />
              <span className="text-xs text-white/50">
                {isOnline ? t("status.online") : t("status.offline")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/mine`}>
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
              {tNav("profile")}
            </Button>
          </Link>
        </div>
      </header>

      {/* Telegram Login Bar */}
      {!tgUser && (
        <div className="bg-gradient-to-r from-kazi-navy/80 to-transparent px-4 py-2 border-b border-kazi-navy/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/70">
              <strong className="text-white">Sign in with Telegram</strong> to sync your chat
            </span>
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white">
              ✈️ Telegram
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-18 h-18 rounded-full bg-gradient-to-br from-kazi-orange to-amber-500 flex items-center justify-center text-3xl mb-5 shadow-lg shadow-kazi-orange/30">
              🤖
            </div>
            <h2 className="text-xl font-bold text-kazi-navy mb-2">{t("welcome.title")}</h2>
            <p className="text-sm text-gray-500 max-w-sm mb-6">{t("welcome.desc")}</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleSend(prompt.text)}
                  className="bg-white border border-gray-200 text-sm px-4 py-2 rounded-full hover:border-kazi-orange hover:text-kazi-orange transition-colors"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
                intent={msg.intent}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[78%] animate-fade-up">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kazi-orange to-amber-500 flex items-center justify-center text-sm shrink-0">
                  🤖
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce-dot" />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce-dot" />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce-dot" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder={t("input.placeholder")}
      />
    </div>
  );
}
