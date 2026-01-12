import React, { useState, useEffect, useRef } from "react";
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import CardHistory from "./CardHistory";
import { useSession } from "../context/SessionContext";
import ScratchpadTab from "./ScratchpadTab";
import { useCardSpawning } from "../hooks/useCardSpawning";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TextScratchpad = ({ sessionId }) => {
  const { sessionId: contextSessionId } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [showCards, setShowCards] = useState(true);
  const [cardCount, setCardCount] = useState(0);
  const preservedCardCountRef = useRef(0); // Preserve card count when hidden
  const [cards, setCards] = useState([]); // Lift cards state up
  const { spawnFrequency, setSpawnFrequency, spawnTrigger } = useCardSpawning({
    showCards,
    sessionId: contextSessionId,
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
            color="gray.800">Scratchpad</Tab>
            
            <Tab as="h2" fontWeight="bold"
            fontSize="lg"
            color="gray.800">History</Tab>
           
          </TabList>
          
          

          <TabPanels flex="1" minHeight={0} display="flex" flexDirection="column" overflow="hidden">
            <TabPanel flex="1" minHeight={0} display="flex" flexDirection="column" p={0} position="relative" overflow="hidden">
              <ScratchpadTab
                sessionId={sessionId}
                showCards={showCards}
                setShowCards={setShowCards}
                cards={cards}
                onCardsChange={handleCardsChange}
                cardCount={cardCount}
                onCardCountChange={handleCardCountChange}
                spawnTrigger={spawnTrigger}
                spawnFrequency={spawnFrequency}
                setSpawnFrequency={setSpawnFrequency}
                hasSession={!!contextSessionId}
              />
            </TabPanel>

            <TabPanel flex="1" p={0} overflow="hidden" height="100%">
              <Box height="100%" overflow="auto">
                <CardHistory sessionId={sessionId} shouldRefresh={activeTab === 1} />
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
};

export default TextScratchpad;
