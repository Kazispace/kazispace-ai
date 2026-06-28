"use client";

import { useEffect, useState } from "react";

interface StreamingTextProps {
  text: string;
  onComplete?: () => void;
}

export function StreamingText({ text, onComplete }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayed(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, 20);
    return () => clearInterval(interval);
  }, [text, onComplete]);

  return <span>{displayed}</span>;
}
