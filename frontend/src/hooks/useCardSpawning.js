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
  const [spawnFrequency, setSpawnFrequency] = useState(60); // seconds
  const [spawnTrigger, setSpawnTrigger] = useState(0);
  const [isSpawning, setIsSpawning] = useState(false);
  const [canSpawn, setCanSpawn] = useState(true);
  const [isFirstShow, setIsFirstShow] = useState(true);

  const spawnIntervalRef = useRef(null);
  const canSpawnRef = useRef(true);
  const lastEventTriggerRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    canSpawnRef.current = canSpawn;
  }, [canSpawn]);

  const stopSpawning = () => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
  };

  const startSpawning = () => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
    }

    spawnIntervalRef.current = setInterval(() => {
      if (showCards && canSpawnRef.current) {
        console.log("Triggering spawn - cards visible and spawning allowed");
        setSpawnTrigger((prev) => prev + 1);
      } else {
        console.log("Skipping spawn - cards hidden or spawning disabled", {
          showCards,
          canSpawn: canSpawnRef.current,
        });
      }
    }, spawnFrequency * 1000);
  };

  // Track when cards are shown/hidden to prevent unwanted spawning
  useEffect(() => {
    if (showCards) {
      console.log("Cards shown - enabling spawning");
      setCanSpawn(true);
      canSpawnRef.current = true;
      setSpawnTrigger(0);

      // Restart the spawning timer if we have a session
      if (sessionId && isSpawning) {
        stopSpawning();
        startSpawning();
      }

      // Trigger initial spawn if this is the first show
      if (isFirstShow && sessionId) {
        setTimeout(() => {
          setSpawnTrigger(1);
        }, 1000);
      }
    } else {
      console.log("Cards hidden - disabling spawning");
      setCanSpawn(false);
      canSpawnRef.current = false;
      setSpawnTrigger(0);
      setIsFirstShow(false);

      if (isSpawning) {
        stopSpawning();
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCards]);

  // Start/stop card spawning based on session
  useEffect(() => {
    if (sessionId && !isSpawning) {
      setIsSpawning(true);
      if (showCards) {
        startSpawning();
      }
    } else if (!sessionId && isSpawning) {
      setIsSpawning(false);
      stopSpawning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Update spawn interval when frequency changes
  useEffect(() => {
    if (isSpawning && showCards) {
      stopSpawning();
      startSpawning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnFrequency, showCards]);

  // Event-based triggers from UML, scratchpad, and chat activity
  useEffect(() => {
    const MIN_EVENT_INTERVAL_MS = 30000;

    const handleEventTrigger = () => {
      if (!sessionId) {
        return;
      }

      const now = Date.now();
      if (now - lastEventTriggerRef.current < MIN_EVENT_INTERVAL_MS) {
        return;
      }
      lastEventTriggerRef.current = now;

      if (showCards) {
        setSpawnTrigger((prev) => prev + 1);
      }
    };

    const eventNames = ['plantuml_updated', 'scratchpad_updated'];
    eventNames.forEach((name) => window.addEventListener(name, handleEventTrigger));

    return () => {
      eventNames.forEach((name) => window.removeEventListener(name, handleEventTrigger));
    };
  }, [sessionId, showCards]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpawning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    spawnFrequency,
    setSpawnFrequency,
    spawnTrigger,
  };
};

