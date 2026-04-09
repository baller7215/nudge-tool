import { useState, useEffect, useRef } from "react";

/**
 * Handles periodic spawning of cards based on session + visibility.
 *
 * Responsibilities moved from TextScratchpad:
 * - spawn interval management
 * - spawn trigger state
 * - visibility-based spawning control
 * - session-based start/stop logic
 */
export const useCardSpawning = ({ showCards, sessionId }) => {
  // Slider value becomes: minimum seconds between nudges.
  const [spawnFrequency, setSpawnFrequency] = useState(60);
  const [spawnTrigger, setSpawnTrigger] = useState(null);

  const showCardsRef = useRef(showCards);
  const sessionIdRef = useRef(sessionId);
  const spawnFrequencyRef = useRef(spawnFrequency);
  const lastNudgeAtRef = useRef(0);
  const nonceRef = useRef(0);

  useEffect(() => {
    showCardsRef.current = showCards;
  }, [showCards]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    spawnFrequencyRef.current = spawnFrequency;
  }, [spawnFrequency]);

  useEffect(() => {
    const maybeTrigger = (payload) => {
      if (!showCardsRef.current) return;

      const now = Date.now();
      const cooldownMs = Number(spawnFrequencyRef.current || 0) * 1000;
      if (cooldownMs > 0 && now - lastNudgeAtRef.current < cooldownMs) return;

      lastNudgeAtRef.current = now;
      nonceRef.current += 1;
      setSpawnTrigger({ nonce: nonceRef.current, ...payload });
    };

    const onUserMessageSent = (e) => {
      const message = e?.detail?.message ?? '';
      if (!String(message || '').trim()) return;
      maybeTrigger({ kind: 'user_message_sent', message: String(message || '') });
    };

    const onChatTypingStopped = (e) => {
      const message = e?.detail?.message ?? '';
      if (!String(message || '').trim()) return;
      maybeTrigger({ kind: 'chat_typing_stopped', message: String(message || '') });
    };

    const onScratchpadTypingStopped = (e) => {
      const workspace = e?.detail?.workspace ?? '';
      if (!String(workspace || '').trim()) return;
      maybeTrigger({ kind: 'scratchpad_typing_stopped', workspace: String(workspace || '') });
    };

    window.addEventListener('user_message_sent', onUserMessageSent);
    window.addEventListener('chat_typing_stopped', onChatTypingStopped);
    window.addEventListener('scratchpad_typing_stopped', onScratchpadTypingStopped);

    return () => {
      window.removeEventListener('user_message_sent', onUserMessageSent);
      window.removeEventListener('chat_typing_stopped', onChatTypingStopped);
      window.removeEventListener('scratchpad_typing_stopped', onScratchpadTypingStopped);
    };
  }, []);

  return {
    spawnFrequency,
    setSpawnFrequency,
    spawnTrigger,
  };
};

