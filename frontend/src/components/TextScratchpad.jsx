import React, { useState, useEffect, useRef } from "react";
import { Box, Button, Textarea, VStack, HStack, Tab, TabList, TabPanel, TabPanels, Tabs, IconButton, Badge, Flex, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Text } from "@chakra-ui/react";
import ExpandableCards from "./ExpandableCards";
import CardHistory from "./CardHistory";
import { FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
import { useSession } from '../context/SessionContext';
import { DownloadIcon } from '@chakra-ui/icons';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ToggleCardsButton = ({ show, count, onClick }) => (
  <Button
    onClick={onClick}
    borderRadius="xl"
    boxShadow="md"
    bg="white"
    p={0}
    minW={0}
    width="44px"
    height="44px"
    position="relative"
    _hover={{ boxShadow: 'lg', bg: 'gray.50' }}
  >
    {show ? <FiChevronsRight size={28} /> : <FiChevronsLeft size={28} />}
    <Badge
      position="absolute"
      top={1}
      right={1}
      bg="#FFD8E4"
      color="black"
      borderRadius="full"
      px={2}
      fontSize="sm"
      fontWeight="bold"
      boxShadow="sm"
    >
      {count}
    </Badge>
  </Button>
);

const TextScratchpad = ({ sessionId }) => {
  const { sessionId: contextSessionId, setSessionId, scratchpadText, setScratchpadText, messages } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [showCards, setShowCards] = useState(true);
  const [cardCount, setCardCount] = useState(0);
  const [spawnFrequency, setSpawnFrequency] = useState(60); // Default 1 minute
  const [isSpawning, setIsSpawning] = useState(false);
  const [spawnTrigger, setSpawnTrigger] = useState(0);
  const spawnIntervalRef = useRef(null);
  const preservedCardCountRef = useRef(0); // Preserve card count when hidden
  const [cards, setCards] = useState([]); // Lift cards state up
  const [isFirstShow, setIsFirstShow] = useState(true); // Track if cards are shown for the first time
  const [canSpawn, setCanSpawn] = useState(true); // Control if spawning is allowed
  const canSpawnRef = useRef(true); // Use ref to track current canSpawn state
  const lastHideTimeRef = useRef(0); // Track when cards were last hidden

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

  // Debug: Monitor canSpawn changes
  useEffect(() => {
    console.log('canSpawn changed to:', canSpawn);
    canSpawnRef.current = canSpawn; // Keep ref in sync
  }, [canSpawn]);

  // Debug: Monitor showCards changes
  useEffect(() => {
    console.log('showCards changed to:', showCards);
  }, [showCards]);

  // Track when cards are shown/hidden to prevent unwanted spawning
  useEffect(() => {
    if (showCards) {
      // Cards are being shown, enable spawning and restart the timer
      console.log('Cards shown - enabling spawning');
      setCanSpawn(true);
      canSpawnRef.current = true; // Update ref immediately
      setSpawnTrigger(0);
      // Restart the spawning timer if we have a session
      if (contextSessionId && isSpawning) {
        stopSpawning();
        startSpawning();
      }
      // Trigger initial spawn if this is the first show
      if (isFirstShow && contextSessionId) {
        setTimeout(() => {
          setSpawnTrigger(1);
        }, 1000); // Small delay to ensure everything is set up
      }
    } else {
      // Cards are being hidden, disable spawning and stop the timer
      console.log('Cards hidden - disabling spawning');
      setCanSpawn(false);
      canSpawnRef.current = false; // Update ref immediately
      setSpawnTrigger(0);
      setIsFirstShow(false);
      // Stop the spawning timer
      if (isSpawning) {
        stopSpawning();
      }
    }
  }, [showCards]); // Remove other dependencies that might cause conflicts

  // Start/stop card spawning based on session
  useEffect(() => {
    if (contextSessionId && !isSpawning) {
      setIsSpawning(true);
      // Only start spawning if cards are visible
      if (showCards) {
        startSpawning();
      }
    } else if (!contextSessionId && isSpawning) {
      setIsSpawning(false);
      stopSpawning();
    }
  }, [contextSessionId]);

  // Update spawn interval when frequency changes
  useEffect(() => {
    if (isSpawning && showCards) {
      stopSpawning();
      startSpawning();
    }
  }, [spawnFrequency, showCards]);

  const startSpawning = () => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
    }
    spawnIntervalRef.current = setInterval(() => {
      // Use ref to get current state instead of closure
      if (showCards && canSpawnRef.current) {
        console.log('Triggering spawn - cards visible and spawning allowed');
        setSpawnTrigger(prev => prev + 1);
      } else {
        console.log('Skipping spawn - cards hidden or spawning disabled', { showCards, canSpawn: canSpawnRef.current });
      }
    }, spawnFrequency * 1000);
  };

  const stopSpawning = () => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpawning();
    };
  }, []);

  const formatFrequency = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) {
        return `${minutes}m`;
      } else {
        return `${minutes}m ${remainingSeconds}s`;
      }
    }
  };

  // Handle first input: start session and save snapshot if needed
  const handleScratchpadChange = async (e) => {
    const newText = e.target.value;
    setScratchpadText(newText);
    if (!contextSessionId && newText.length > 0) {
      try {
        const newSessionId = await window.sessionApi.createSession({
          metadata: {
            userAgent: navigator.userAgent,
            deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop'
          }
        });
        setSessionId(newSessionId);
        await window.sessionApi.addScratchpadSnapshot(newSessionId, newText);
      } catch (err) {
        console.error('Failed to create session and save initial scratchpad snapshot:', err);
      }
    } else if (contextSessionId && newText.length > 0) {
      // If session already exists, do nothing (snapshotting handled elsewhere)
    }
  };

  // Save button handler
  const handleSave = () => {
    let content = '';
    content += '--- Scratchpad ---\n';
    content += scratchpadText + '\n\n';
    content += '--- Chat History ---\n';
    messages.forEach((msg, idx) => {
      if (msg.role === 'user') {
        content += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant' && msg.nudge) {
        content += `Nudge: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        content += `Assistant: ${msg.content}\n`;
      }
    });
    // Download as .txt
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nudge-session.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const handleLogout = () => {
    window.location.href = `${BACKEND_URL}/api/auth/logout`;
  };

  return (
    <Box display="flex" flexDirection="column" height="100%" width="100%" bg="white" position="relative" overflow="hidden">
      <Box display="flex" position="relative" zIndex={2}>
        {/* <Flex align="center" justify="space-between" bg="white" px={8} py={2} position="relative" zIndex={2} width="100%">
          <Box fontWeight="bold" fontSize="lg" color="gray.800">
            Scratchpad
          </Box>
          <Button leftIcon={<DownloadIcon />} colorScheme="gray" variant="outline" size="sm" onClick={handleSave}>
            Save
          </Button>
          
        </Flex> */}
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
              <Box display="flex" flexDirection="column" height="100%" overflow="hidden">
                <Box flex="1" minHeight={0} overflow="auto" px={5} py={5}>
                  <Textarea
                    placeholder="Start typing here..."
                    value={scratchpadText}
                    onChange={handleScratchpadChange}
                    size="lg"
                    resize="none"
                    width="100%"
                    height="100%"
                    bg="white"
                    border="none"
                    outline="none"
                    _focus={{ border: "none", boxShadow: "none" }}
                    p={0}
                  />
                </Box>
                {showCards && (
                  <Box flexShrink={0} mt={2}>
                    <ExpandableCards 
                      sessionId={sessionId} 
                      onCardCountChange={handleCardCountChange}
                      onCardsChange={handleCardsChange}
                      cards={cards}
                      spawnTrigger={spawnTrigger}
                    />
                  </Box>
                )}
                {/* Toggle Button Row */}
                <Box 
                  bg="white" 
                  px={5} 
                  py={3} 
                  borderTop="1px solid" 
                  borderColor="gray.200"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  flexShrink={0}
                >
                <HStack spacing={4} align="center">
                  <ToggleCardsButton show={showCards} count={cardCount} onClick={() => setShowCards((v) => !v)} />
                  {contextSessionId && (
                    <VStack spacing={2} align="start">
                      <Text fontSize="sm" color="gray.600" fontWeight="medium">
                        Move slider to adjust card frequency
                      </Text>
                      <HStack spacing={3} align="center">
                        <Text fontSize="sm" color="gray.600" minW="60px">
                          {formatFrequency(spawnFrequency)}
                        </Text>
                        <Box flex="1" minW="200px" maxW="300px">
                          <Slider
                            value={spawnFrequency}
                            onChange={setSpawnFrequency}
                            min={15}
                            max={600}
                            step={15}
                            colorScheme="pink"
                          >
                            <SliderTrack>
                              <SliderFilledTrack />
                            </SliderTrack>
                            <SliderThumb />
                          </Slider>
                        </Box>
                      </HStack>
                    </VStack>
                  )}
                </HStack>
                </Box>
              </Box>
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
