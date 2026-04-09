import React, { useState, useEffect, useRef } from "react";
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import CardHistory from "./CardHistory";
import ExpandableCards from "./ExpandableCards";
import CardControls from "./CardControls";
import { useSession } from "../context/SessionContext";
import ScratchpadTab from "./ScratchpadTab";
import PlantUmlTab from "./PlantUmlTab";
import { useCardSpawning } from "../hooks/useCardSpawning";
import { sessionApi } from "../../api/sessionApi";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TextScratchpad = ({ sessionId }) => {
  const { sessionId: contextSessionId } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [showCards, setShowCards] = useState(true);
  const [cardCount, setCardCount] = useState(0);
  const preservedCardCountRef = useRef(0); // preserve card count when hidden
  const [cards, setCards] = useState([]); // lift cards state up
  const didHydrateFromSessionRef = useRef(false);
  const previousSessionIdRef = useRef(null);
  const { spawnFrequency, setSpawnFrequency, spawnTrigger } = useCardSpawning({
    showCards,
    sessionId: contextSessionId,
  });

  const isRealSessionId = (value) => Boolean(value && !String(value).startsWith("temp_"));

  const normalizeDisplayId = (value = "") => String(value).replace(/^#/, "").trim().toUpperCase();

  const mapSessionNudgeToCard = (nudgeState) => ({
    id: `${nudgeState.displayId}-${nudgeState.createdAt || Date.now()}`,
    displayId: normalizeDisplayId(nudgeState.displayId),
    title: nudgeState.title || "Nudge",
    topic: nudgeState.category || null,
    goal: nudgeState.category || null,
    shortDescription: nudgeState.content || "",
    fullContent: nudgeState.content || "",
    nudgeId: nudgeState.nudgeId || null,
    status: nudgeState.status || "active",
  });

  const handleTabChange = (index) => {
    setActiveTab(index);  
  };

  // Callback to update card count from ExpandableCards
  const handleCardCountChange = (count) => {
    setCardCount(count);
    preservedCardCountRef.current = count; // Store the count
  };

  // Callback to update cards from ExpandableCards
  const handleCardsChange = (newCards) => {
    setCards(newCards);
  };

  // Restore card count when cards are shown again
  useEffect(() => {
    if (showCards && preservedCardCountRef.current > 0) {
      setCardCount(preservedCardCountRef.current);
    }
  }, [showCards]);

  // Rehydrate cards from persisted nudgeStates for current session.
  useEffect(() => {
    if (previousSessionIdRef.current !== contextSessionId) {
      didHydrateFromSessionRef.current = false;
      previousSessionIdRef.current = contextSessionId;
      if (!contextSessionId) {
        setCards([]);
      }
    }

    const hydrate = async () => {
      if (!isRealSessionId(contextSessionId)) return;
      if (didHydrateFromSessionRef.current) return;
      try {
        const session = await sessionApi.getSession(contextSessionId);
        const nudgeStates = Array.isArray(session?.nudgeStates) ? session.nudgeStates : [];
        if (nudgeStates.length) {
          setCards(nudgeStates.map(mapSessionNudgeToCard));
        }
        didHydrateFromSessionRef.current = true;
      } catch (error) {
        console.error("Failed to hydrate cards from session nudge states:", error);
      }
    };

    hydrate();
  }, [contextSessionId]);

  const upsertCardStateToSession = async (card, statusOverride = null) => {
    if (!isRealSessionId(contextSessionId) || !card?.displayId) return;
    try {
      await sessionApi.upsertNudgeState(contextSessionId, {
        displayId: normalizeDisplayId(card.displayId),
        nudgeId: card.nudgeId || null,
        title: card.title || "Nudge",
        content: card.fullContent || card.shortDescription || "",
        category: card.topic || card.goal || "nudge",
        status: statusOverride || card.status || "active",
      });
    } catch (error) {
      console.error("Failed to persist nudge state:", error);
    }
  };

  const handleCardCreated = async (card) => {
    await upsertCardStateToSession(card, card.status || "active");
  };

  const handleCardStatusChange = async (displayId, status) => {
    const normalized = normalizeDisplayId(displayId);
    let targetCard = null;
    setCards((prev) =>
      prev.map((card) => {
        if (normalizeDisplayId(card.displayId) !== normalized) return card;
        targetCard = { ...card, status };
        return targetCard;
      }),
    );
    if (targetCard) {
      await upsertCardStateToSession(targetCard, status);
    }
  };

  const handleToggleNudgeCompletionByDisplayId = async (displayId) => {
    const normalized = normalizeDisplayId(displayId);
    const current = cards.find((c) => normalizeDisplayId(c.displayId) === normalized);
    if (!current) return null;

    if (isRealSessionId(contextSessionId)) {
      try {
        await sessionApi.toggleNudgeCompletion(contextSessionId, normalized);
      } catch (error) {
        console.error("Failed to toggle nudge completion:", error);
        return null;
      }
    }

    const nextStatus = current.status === "completed" ? "active" : "completed";
    setCards((prev) =>
      prev.map((card) =>
        normalizeDisplayId(card.displayId) === normalized ? { ...card, status: nextStatus } : card,
      ),
    );
    return nextStatus;
  };

  const handleLogout = () => {
    window.location.href = `${BACKEND_URL}/api/auth/logout`;
  };

  return (
    <Box display="flex" flexDirection="column" height="100%" width="100%" bg="white" position="relative" overflow="hidden">
      <Box display="flex" position="relative" zIndex={2}>
         <Box
              position="relative"
              top={0}
              left={0}
              right={0}
              height="4px"
              bg="#FFD8E4"
              borderTopLeftRadius="lg"
              borderTopRightRadius="lg"
            />

     
      </Box>
      <Box
        flex="1"
        minHeight={0}
        mx="auto"
        width="100%"
        bg="white"
        display="flex"
        flexDirection="column"
        position="relative"
        overflow="hidden"
      >
        <Box flex="1" minHeight={0} display="flex" flexDirection="column" overflow="hidden">
          <Tabs
            variant="enclosed"
            flex="1"
            minHeight={0}
            display="flex"
            flexDirection="column"
            onChange={handleTabChange}
            height="100%"
          >
            <TabList flexShrink={0}>
              <Tab as="h2" fontWeight="bold"
              fontSize="lg"
              color="gray.800"
              cursor="pointer">UML</Tab>

              <Tab as="h2" fontWeight="bold"
              fontSize="lg"
              color="gray.800"
              cursor="pointer">Scratchpad</Tab>

              <Tab as="h2" fontWeight="bold"
              fontSize="lg"
              color="gray.800"
              cursor="pointer">History</Tab>

            </TabList>

            <TabPanels flex="1" minHeight={0} display="flex" flexDirection="column" overflow="hidden">
              <TabPanel flex="1" minHeight={0} display="flex" flexDirection="column" p={0} position="relative" overflow="hidden">
                <PlantUmlTab />
              </TabPanel>
              <TabPanel flex="1" minHeight={0} display="flex" flexDirection="column" p={0} position="relative" overflow="hidden">
                <ScratchpadTab
                  cards={cards}
                  onToggleNudgeCompletionByDisplayId={handleToggleNudgeCompletionByDisplayId}
                />
              </TabPanel>

              <TabPanel flex="1" p={0} overflow="hidden" height="100%">
                <Box height="100%" overflow="auto">
                  <CardHistory sessionId={sessionId} shouldRefresh={activeTab === 2} />
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>

          {/* Shared nudge panel – visible for both UML and Scratchpad tabs */}
          {activeTab < 2 && (
            <Box flexShrink={0} borderTop="1px" borderColor="gray.200" bg="white">
              {showCards && (
                <ExpandableCards
                  sessionId={sessionId}
                  onCardCountChange={handleCardCountChange}
                  onCardsChange={handleCardsChange}
                  onCardCreated={handleCardCreated}
                  onCardStatusChange={handleCardStatusChange}
                  cards={cards}
                  spawnTrigger={spawnTrigger}
                />
              )}
              <CardControls
                showCards={showCards}
                onToggleShowCards={() => setShowCards((v) => !v)}
                cardCount={cardCount}
                spawnFrequency={spawnFrequency}
                onChangeSpawnFrequency={setSpawnFrequency}
                hasSession={!!contextSessionId}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default TextScratchpad;
