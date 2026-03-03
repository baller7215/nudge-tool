import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  IconButton,
  Flex,
  Button,
  HStack,
  VStack,
  Tooltip,
  useToast,
} from '@chakra-ui/react';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { sessionApi } from '../../api/sessionApi.js';
import { apiUrl } from '../../api/index.jsx';
import { useSession } from '../context/SessionContext.jsx';

const ExpandableCards = ({ sessionId, onCardCountChange, onCardsChange, cards, spawnTrigger }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [cardFeedback, setCardFeedback] = useState({}); // { cardId: 'like' | 'dislike' }
  const [filter, setFilter] = useState('all'); // 'all', 'liked', 'disliked', 'neutral'
  const toast = useToast();
  const { scratchpadText, messages } = useSession();

  const MAX_ACTIVE_AUTO_CARDS = 2;

  console.log('ExpandableCards sessionId:', sessionId);

  // Listen for spawn triggers
  useEffect(() => {
    if (spawnTrigger) {
      fetchNudges({ useSmart: true, trigger: 'timer' });
    }
  }, [spawnTrigger]);

  // Notify parent of card count changes
  useEffect(() => {
    if (onCardCountChange) {
      onCardCountChange(cards.length);
    }
  }, [cards, onCardCountChange]);

  // Filter cards based on current filter
  const filteredCards = cards.filter(card => {
    if (filter === 'all') return true;
    if (filter === 'liked') return cardFeedback[card.id] === 'like';
    if (filter === 'disliked') return cardFeedback[card.id] === 'dislike';
    if (filter === 'neutral') return !cardFeedback[card.id] || cardFeedback[card.id] === 'neutral';
    return true;
  });

  const fetchNudges = async ({ useSmart = true, trigger = 'timer' } = {}) => {
    // Basic cap on automatically spawned cards to avoid overwhelm
    if (trigger !== 'manual_card' && cards.length >= MAX_ACTIVE_AUTO_CARDS) {
      return;
    }

    setIsLoading(true);
    try {
      // Get list of already-shown nudge IDs to prevent duplicates
      const shownNudgeIds = cards.map(card => card.nudgeId).filter(Boolean);
      
      let data;
      
      if (useSmart && sessionId && (scratchpadText || messages.length > 0)) {
        // Use smart nudge API with context
        console.log('Fetching smart nudge with context');
        const response = await fetch(apiUrl('/api/smart'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            scratchpadText,
            shownNudgeIds, // Send already-shown IDs to backend
            messages: messages.filter(m => m.role !== 'assistant' || !m.nudge), // Exclude existing nudges from context
            trigger,
          })
        });
        
        if (!response.ok) throw new Error("Failed to fetch smart nudge");
        data = await response.json();
      } else {
        // Fall back to random nudge
        console.log('Fetching random nudge');
        
        // For random nudges, we need to exclude already-shown ones
        // Try to get a unique nudge by filtering on the frontend
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
          const url = sessionId 
            ? apiUrl(`/api/random?sessionId=${sessionId}`)
            : apiUrl("/api/random");
          
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch nudge");
          data = await response.json();
          
          // Check if this is a duplicate
          const isDuplicate = shownNudgeIds.includes(data._id.toString());
          if (!isDuplicate) break;
          
          attempts++;
        }
      }

      // Handle LLM-generated nudges array shape first
      if (data && Array.isArray(data.nudges)) {
        const generated = data.nudges;

        if (!generated.length) {
          console.log('No generated nudges returned');
          return;
        }

        const now = Date.now();
        let newCards = [...cards];

        generated.forEach((nudge, idx) => {
          if (!nudge || !nudge.text) return;
          if (newCards.length >= MAX_ACTIVE_AUTO_CARDS && trigger !== 'manual_card') {
            return;
          }

          const titleSource = nudge.topic || nudge.goal || 'Nudge';
          const title =
            titleSource.charAt(0).toUpperCase() + titleSource.slice(1);

          const card = {
            id: now + idx,
            title,
            shortDescription: nudge.text,
            fullContent: nudge.text,
            nudgeId: nudge.id || null,
          };
          newCards = [...newCards, card];
        });

        if (newCards.length !== cards.length) {
          onCardsChange(newCards);
        }
      } else if (data && data.text) {
        // Backwards compatibility with single-nudge response shape
        const newCard = {
          id: Date.now(),
          title: data.category || 'Nudge',
          shortDescription: data.text,
          fullContent: data.text,
          nudgeId: data._id,
        };
        const newCards = [...cards, newCard];
        onCardsChange(newCards);
      }
    } catch (error) {
      console.error("Error fetching nudge:", error);
      toast({
        title: "Failed to load nudge",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (card) => {
    console.log('Liking card:', card);
    setCardFeedback(prev => ({ ...prev, [card.id]: 'like' }));
  };

  const handleDislike = async (card) => {
    console.log('Disliking card:', card);
    setCardFeedback(prev => ({ ...prev, [card.id]: 'dislike' }));
  };

  const handleMoveToHistory = async (card) => {
    console.log('Moving card to history:', card);
    const newCards = cards.filter(c => c.id !== card.id);
    onCardsChange(newCards);
    
    // Track card interaction if session exists
    if (sessionId) {
      try {
        const cardData = {
          cardId: card.id.toString(),
          cardTitle: card.title,
          cardContent: card.fullContent,
          action: cardFeedback[card.id] || 'neutral',
          nudgeId: card.nudgeId
        };
        console.log('Tracking card interaction:', cardData);
        await sessionApi.addCardInteraction(sessionId, cardData);
        console.log('Card interaction tracked successfully');
      } catch (error) {
        console.error('Error tracking card interaction:', error);
      }
    } else {
      console.log('No sessionId available for tracking');
    }
  };

  return (
    <Box width="100%" py={5} px={5}>
      <Flex justify="space-between" align="center" mb={4}>
        <Button
          as="h3"
          colorScheme="pink"
          leftIcon={<Box as="span" fontSize="xl">+</Box>}
          onClick={() => fetchNudges({ useSmart: true, trigger: 'manual_card' })} // Manual "Add Card" uses smart logic
          isLoading={isLoading}
          borderRadius="lg"
          px={4}
          py={2}
          fontWeight="bold"
        >
          Add Card
        </Button>
        
        {/* Filter Buttons */}
        <HStack spacing={2}>
          <Button
            size="sm"
            variant={filter === 'all' ? 'solid' : 'outline'}
            colorScheme="purple"
            onClick={() => setFilter('all')}
          >
            All ({cards.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'liked' ? 'solid' : 'outline'}
            colorScheme="green"
            onClick={() => setFilter('liked')}
          >
            Liked ({cards.filter(card => cardFeedback[card.id] === 'like').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'disliked' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setFilter('disliked')}
          >
            Disliked ({cards.filter(card => cardFeedback[card.id] === 'dislike').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'neutral' ? 'solid' : 'outline'}
            colorScheme="gray"
            onClick={() => setFilter('neutral')}
          >
            Neutral ({cards.filter(card => !cardFeedback[card.id] || cardFeedback[card.id] === 'neutral').length})
          </Button>
        </HStack>
      </Flex>
      
      <HStack spacing={4} overflowX="auto" align="stretch" pb={2}>
        {filteredCards.map((card, idx) => (
          <Box
            key={card.id}
            bg="white"
            borderRadius="xl"
            boxShadow="md"
            border="1px solid"
            borderColor="gray.200"
            minW="260px"
            maxW="260px"
            p={4}
            display="flex"
            flexDirection="column"
            justifyContent="space-between"
            position="relative"
          >
            {/* X button to move to history */}
            <Tooltip label="Move to history" hasArrow>
              <IconButton
                icon={<Box as="span" fontSize="lg">×</Box>}
                aria-label="Move to history"
                variant="ghost"
                onClick={() => handleMoveToHistory(card)}
                _hover={{ bg: 'gray.100' }}
                borderRadius="full"
                position="absolute"
                top={2}
                right={2}
                size="sm"
                color="gray.500"
              />
            </Tooltip>
            
            <VStack align="stretch" spacing={2} flex="1">
              <Text as="h4" fontWeight="bold" fontSize="md" mb={1}>{card.title}</Text>
              <Text fontSize="sm" color="gray.700">{card.shortDescription}</Text>
            </VStack>
            <HStack spacing={4} mt={4} justify="center">
              <Tooltip label="Like" hasArrow>
                <IconButton
                  icon={<FaThumbsUp size={24} />}
                  aria-label="Like"
                  variant="ghost"
                  onClick={() => handleLike(card)}
                  color={cardFeedback[card.id] === 'like' ? 'green.500' : 'gray.400'}
                  _hover={{ 
                    bg: 'gray.100',
                    color: cardFeedback[card.id] === 'like' ? 'green.600' : 'gray.500'
                  }}
                  borderRadius="full"
                  size="lg"
                />
              </Tooltip>
              <Tooltip label="Dislike" hasArrow>
                <IconButton
                  icon={<FaThumbsDown size={24} />}
                  aria-label="Dislike"
                  variant="ghost"
                  onClick={() => handleDislike(card)}
                  color={cardFeedback[card.id] === 'dislike' ? 'red.500' : 'gray.400'}
                  _hover={{ 
                    bg: 'gray.100',
                    color: cardFeedback[card.id] === 'dislike' ? 'red.600' : 'gray.500'
                  }}
                  borderRadius="full"
                  size="lg"
                />
              </Tooltip>
            </HStack>
          </Box>
        ))}
      </HStack>
    </Box>
  );
};

export default ExpandableCards; 