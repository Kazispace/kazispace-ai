'use client';

import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      setBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setBlob(null);
  }, []);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setIsRecording(false);
  }, []);

  return { isRecording, blob, start, stop, reset };
}
