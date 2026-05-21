import React, { useState, useEffect, useRef } from 'react';
import {
  Badge,
  Box,
  Text,
  IconButton,
  Flex,
  Button,
  HStack,
  VStack,
  Tooltip,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { sessionApi } from '../../api/sessionApi.js';
import { apiUrl } from '../../api/index.jsx';
import { useSession } from '../context/SessionContext.jsx';

const ExpandableCards = ({
  sessionId,
  onCardCountChange,
  onCardsChange,
  onCardCreated,
  onCardStatusChange,
  cards,
  spawnTrigger,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [cardFeedback, setCardFeedback] = useState({}); // { cardId: 'like' | 'dislike' }
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed', 'dismissed'
  const [expandedCard, setExpandedCard] = useState(null);
  const { isOpen: isExpandedOpen, onOpen: onExpandedOpen, onClose: onExpandedClose } = useDisclosure();
  const toast = useToast();
  const { scratchpadText, messages } = useSession();

  // Constraints:
  // - cap active cards to avoid overwhelm
  const MAX_ACTIVE_CARDS = 5;

  // Track what we've already shown this session so we don't repeat topics/text.
  const seenTopicsRef = useRef(new Set());
  const seenTextHashesRef = useRef(new Set());
  const displayIdCountersRef = useRef({});

  const normalizeText = (text = '') =>
    String(text)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const hashText = (text) => {
    // Simple stable hash for de-duping very similar repeats
    const s = normalizeText(text);
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 33) ^ s.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };

  const resolveDisplayPrefix = (source = '') => {
    const normalized = String(source || '').toLowerCase();
    if (normalized.includes('structure')) return 'S';
    if (normalized.includes('expand')) return 'E';
    if (normalized.includes('reflect')) return 'R';
    return 'N';
  };

  const nextDisplayId = (source = '') => {
    const prefix = resolveDisplayPrefix(source);
    const next = (displayIdCountersRef.current[prefix] || 0) + 1;
    displayIdCountersRef.current[prefix] = next;
    return `${prefix}${next}`;
  };

  console.log('ExpandableCards sessionId:', sessionId);

  // Seed seen sets/counters from existing cards (for hot reload / persistence)
  useEffect(() => {
    cards.forEach((c) => {
      const topic = normalizeText(c.topic || c.title || '');
      if (topic) seenTopicsRef.current.add(topic);
      if (c.fullContent) seenTextHashesRef.current.add(hashText(c.fullContent));
      if (c.displayId) {
        const match = String(c.displayId).toUpperCase().match(/^([A-Z])(\d+)$/);
        if (match) {
          const [, prefix, count] = match;
          displayIdCountersRef.current[prefix] = Math.max(
            displayIdCountersRef.current[prefix] || 0,
            Number(count),
          );
        }
      }
    });
  }, [cards]);

  // Listen for spawn triggers
  useEffect(() => {
    if (spawnTrigger) {
      fetchNudges({
        useSmart: true,
        trigger: spawnTrigger.kind || 'typing_stopped',
        latestUserInput: spawnTrigger.message || '',
      });
    }
  }, [spawnTrigger]);

  // Notify parent of card count changes
  useEffect(() => {
    if (onCardCountChange) {
      onCardCountChange(cards.length);
    }
  }, [cards, onCardCountChange]);

  // Cards removed from the panel (×) stay in session state for scratchpad `closes nudge` commands.
  const panelCards = cards.filter((card) => !card.archivedFromPanel);

  // Filter cards based on current filter
  const filteredCards = panelCards.filter(card => {
    if (filter === 'all') return true;
    if (filter === 'active') return (card.status || 'active') === 'active';
    if (filter === 'completed') return card.status === 'completed';
    if (filter === 'dismissed') return card.status === 'dismissed';
    return true;
  });

  const fetchNudges = async ({ useSmart = true, trigger = 'timer', latestUserInput = '' } = {}) => {
    // Global cap: no more than MAX_ACTIVE_CARDS active at once
    const activeCount = panelCards.filter((c) => (c.status || 'active') === 'active').length;
    if (activeCount >= MAX_ACTIVE_CARDS) {
      if (trigger === 'manual_card') {
        toast({
          title: "Too many active nudges",
          description: "Move a card to history to make room for a new one.",
          status: "info",
          duration: 2500,
          isClosable: true,
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      // Get list of already-shown nudge IDs to prevent duplicates
      const shownNudgeIds = cards.map(card => card.nudgeId).filter(Boolean);
      
      let data;
      
      if (useSmart && (scratchpadText || messages.length > 0)) {
        const lastUser = [...messages]
          .reverse()
          .find((m) => m?.role === 'user' && String(m?.content || '').trim());
        const resolvedLatestUserInput = String(latestUserInput || lastUser?.content || '').trim();

        // Use smart nudge API with context
        console.log('Fetching smart nudge with context');

        // Ask backend to avoid repeating topics we've already shown
        const avoidTopics = Array.from(seenTopicsRef.current).slice(-20);

        const response = await fetch(apiUrl('/api/smart'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            scratchpadText,
            shownNudgeIds, // Send already-shown IDs to backend
            messages: messages.filter(m => m.role !== 'assistant' || !m.nudge), // Exclude existing nudges from context
            trigger,
            avoidTopics,
            latestUserInput: resolvedLatestUserInput,
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

        // Filter out duplicates by topic and text hash. We only add ONE card per fetch.
        const candidates = generated
          .filter((n) => n && typeof n.text === 'string' && n.text.trim())
          .map((n) => ({
            ...n,
            _topicKey: normalizeText(n.topic || n.goal || 'nudge'),
            _hash: hashText(n.text),
          }));

        const filtered = candidates.filter((n) => {
          if (seenTextHashesRef.current.has(n._hash)) return false;
          if (n._topicKey && seenTopicsRef.current.has(n._topicKey)) return false;
          return true;
        });

        const chosen = filtered[0] || candidates.find((n) => !seenTextHashesRef.current.has(n._hash));

        if (!chosen) {
          console.log('All generated nudges were duplicates; skipping');
          return;
        }

        const titleSource = chosen.topic || chosen.goal || 'Nudge';
        const title = titleSource.charAt(0).toUpperCase() + titleSource.slice(1);

        const newCard = {
          id: Date.now(),
          displayId: nextDisplayId(chosen.topic || chosen.goal || title),
          title,
          topic: chosen.topic || null,
          goal: chosen.goal || null,
          shortDescription: chosen.text,
          fullContent: chosen.text,
          nudgeId: chosen.id || null,
          status: 'active',
        };

        // Update seen sets (persist through moving to history)
        if (chosen._topicKey) seenTopicsRef.current.add(chosen._topicKey);
        seenTextHashesRef.current.add(chosen._hash);

        const nextCards = [...cards, newCard];
        onCardsChange(nextCards);
        if (onCardCreated) {
          onCardCreated(newCard);
        }
      } else if (data && data.text) {
        // Backwards compatibility with single-nudge response shape
        const topicKey = normalizeText(data.category || 'nudge');
        const textHash = hashText(data.text);

        if (seenTextHashesRef.current.has(textHash) || seenTopicsRef.current.has(topicKey)) {
          console.log('Legacy nudge was a duplicate; skipping');
          return;
        }

        seenTopicsRef.current.add(topicKey);
        seenTextHashesRef.current.add(textHash);

        const newCard = {
          id: Date.now(),
          displayId: nextDisplayId(data.category || 'nudge'),
          title: data.category || 'Nudge',
          topic: data.category || null,
          shortDescription: data.text,
          fullContent: data.text,
          nudgeId: data._id,
          status: 'active',
        };
        const newCards = [...cards, newCard];
        onCardsChange(newCards);
        if (onCardCreated) {
          onCardCreated(newCard);
        }
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
    const newCards = cards.map((c) =>
      c.id === card.id ? { ...c, archivedFromPanel: true } : c,
    );
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

  const handleSetStatus = (card, status) => {
    if (onCardStatusChange) {
      onCardStatusChange(card.displayId, status);
    }
    if (expandedCard?.id === card.id) {
      setExpandedCard((prev) => (prev ? { ...prev, status } : prev));
    }
  };

  const stopCardClick = (event) => event.stopPropagation();

  const openExpandedCard = (card) => {
    setExpandedCard(card);
    onExpandedOpen();
  };

  const closeExpandedCard = () => {
    onExpandedClose();
    setExpandedCard(null);
  };

  const statusColorScheme = (status) => {
    if (status === 'completed') return 'green';
    if (status === 'dismissed') return 'gray';
    return 'pink';
  };

  useEffect(() => {
    if (!expandedCard) return;
    const updated = cards.find((c) => c.id === expandedCard.id);
    if (!updated) {
      closeExpandedCard();
      return;
    }
    const changed =
      updated.status !== expandedCard.status ||
      updated.fullContent !== expandedCard.fullContent ||
      updated.shortDescription !== expandedCard.shortDescription;
    if (changed) setExpandedCard(updated);
  }, [cards, expandedCard]);

  const renderCardActions = (card, { compact = false } = {}) => {
    const btnSize = compact ? 'xs' : 'sm';
    const iconSize = compact ? 14 : 18;

    return (
    <HStack spacing={compact ? 1 : 2} justify="space-between" w="100%">
      <HStack spacing={compact ? 1 : 2}>
        <Button
          size={btnSize}
          h={compact ? '22px' : undefined}
          fontSize={compact ? '10px' : undefined}
          px={compact ? 2 : undefined}
          colorScheme={(card.status || 'active') === 'completed' ? 'blue' : 'green'}
          variant="outline"
          onClick={(e) => {
            stopCardClick(e);
            handleSetStatus(card, (card.status || 'active') === 'completed' ? 'active' : 'completed');
          }}
        >
          {(card.status || 'active') === 'completed' ? 'Reopen' : compact ? 'Done' : 'Mark done'}
        </Button>
        <Button
          size={btnSize}
          h={compact ? '22px' : undefined}
          fontSize={compact ? '10px' : undefined}
          px={compact ? 2 : undefined}
          colorScheme={(card.status || 'active') === 'dismissed' ? 'blue' : 'gray'}
          variant="outline"
          onClick={(e) => {
            stopCardClick(e);
            handleSetStatus(card, (card.status || 'active') === 'dismissed' ? 'active' : 'dismissed');
          }}
        >
          {(card.status || 'active') === 'dismissed' ? (compact ? 'Undo' : 'Undismiss') : 'Dismiss'}
        </Button>
      </HStack>
      <HStack spacing={0}>
        <Tooltip label="Like" hasArrow>
          <IconButton
            icon={<FaThumbsUp size={iconSize} />}
            aria-label="Like"
            variant="ghost"
            size={btnSize}
            onClick={(e) => {
              stopCardClick(e);
              handleLike(card);
            }}
            color={cardFeedback[card.id] === 'like' ? 'green.500' : 'gray.400'}
            _hover={{
              bg: 'gray.100',
              color: cardFeedback[card.id] === 'like' ? 'green.600' : 'gray.500',
            }}
            borderRadius="full"
          />
        </Tooltip>
        <Tooltip label="Dislike" hasArrow>
          <IconButton
            icon={<FaThumbsDown size={iconSize} />}
            aria-label="Dislike"
            variant="ghost"
            size={btnSize}
            onClick={(e) => {
              stopCardClick(e);
              handleDislike(card);
            }}
            color={cardFeedback[card.id] === 'dislike' ? 'red.500' : 'gray.400'}
            _hover={{
              bg: 'gray.100',
              color: cardFeedback[card.id] === 'dislike' ? 'red.600' : 'gray.500',
            }}
            borderRadius="full"
          />
        </Tooltip>
      </HStack>
    </HStack>
    );
  };

  return (
    <Box width="100%" py={3} px={4} display="flex" flexDirection="column" minH={0}>
      <Flex justify="space-between" align="center" mb={2.5} flexWrap="wrap" gap={2} flexShrink={0}>
        <Button
          as="h3"
          colorScheme="pink"
          size="sm"
          leftIcon={<Box as="span" fontSize="lg">+</Box>}
          onClick={() => fetchNudges({ useSmart: true, trigger: 'manual_card' })} // Manual "Add Card" uses smart logic
          isLoading={isLoading}
          borderRadius="md"
          px={3}
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
            variant={filter === 'active' ? 'solid' : 'outline'}
            colorScheme="green"
            onClick={() => setFilter('active')}
          >
            Active ({panelCards.filter(card => (card.status || 'active') === 'active').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'completed' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setFilter('completed')}
          >
            Completed ({cards.filter(card => card.status === 'completed').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'dismissed' ? 'solid' : 'outline'}
            colorScheme="gray"
            onClick={() => setFilter('dismissed')}
          >
            Dismissed ({cards.filter(card => card.status === 'dismissed').length})
          </Button>
        </HStack>
      </Flex>
      
      <HStack spacing={3} overflowX="auto" align="stretch" py={2} flexShrink={0} sx={{ scrollbarGutter: "stable" }}>
        {filteredCards.map((card) => (
          <Box
            key={card.id}
            role="button"
            tabIndex={0}
            aria-label={`Open nudge ${card.displayId || card.title}`}
            bg="white"
            borderRadius="md"
            boxShadow="sm"
            border="1px solid"
            borderColor="gray.200"
            minW="220px"
            maxW="220px"
            maxH="168px"
            p={2.5}
            display="flex"
            flexDirection="column"
            justifyContent="space-between"
            position="relative"
            cursor="pointer"
            transition="border-color 0.15s, box-shadow 0.15s, transform 0.15s"
            _hover={{
              borderColor: 'pink.300',
              boxShadow: 'md',
              transform: 'translateY(-1px)',
            }}
            _focusVisible={{
              outline: '2px solid',
              outlineColor: 'pink.400',
              outlineOffset: '2px',
            }}
            onClick={() => openExpandedCard(card)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openExpandedCard(card);
              }
            }}
          >
            <Tooltip label="Move to history" hasArrow>
              <IconButton
                icon={<Box as="span" fontSize="lg">×</Box>}
                aria-label="Move to history"
                variant="ghost"
                onClick={(e) => {
                  stopCardClick(e);
                  handleMoveToHistory(card);
                }}
                _hover={{ bg: 'gray.100' }}
                borderRadius="full"
                position="absolute"
                top={2}
                right={2}
                size="sm"
                color="gray.500"
                zIndex={1}
              />
            </Tooltip>

            <VStack align="stretch" spacing={0.5} flex="1" minH={0} overflow="hidden" pointerEvents="none">
              <Text as="h4" fontWeight="bold" fontSize="xs" noOfLines={1} pr={5}>
                {card.displayId ? `#${card.displayId} · ` : ''}{card.title}
              </Text>
              <Text fontSize="10px" color="gray.500" textTransform="uppercase" lineHeight="short">
                {card.status || 'active'}
              </Text>
              <Text fontSize="sm" color="gray.700" lineHeight="1.35" noOfLines={4} flex="1">
                {card.shortDescription}
              </Text>
              <Text fontSize="10px" color="pink.500" fontWeight="medium">
                Tap to expand
              </Text>
            </VStack>
            <Box mt={1} flexShrink={0} onClick={stopCardClick}>
              {renderCardActions(card, { compact: true })}
            </Box>
          </Box>
        ))}
      </HStack>

      <Modal
        isOpen={isExpandedOpen && Boolean(expandedCard)}
        onClose={closeExpandedCard}
        size="md"
        motionPreset="scale"
        isCentered
      >
        <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(2px)" />
        <ModalContent borderRadius="xl" mx={4}>
          {expandedCard ? (
            <>
              <ModalHeader pb={2} pr={12}>
                <HStack spacing={2} align="center" flexWrap="wrap">
                  <Text fontSize="lg" fontWeight="bold">
                    {expandedCard.displayId ? `#${expandedCard.displayId}` : 'Nudge'}
                    {expandedCard.title ? ` · ${expandedCard.title}` : ''}
                  </Text>
                  <Badge colorScheme={statusColorScheme(expandedCard.status || 'active')} textTransform="uppercase">
                    {expandedCard.status || 'active'}
                  </Badge>
                </HStack>
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody pt={0}>
                <Text fontSize="md" color="gray.700" lineHeight="1.6" whiteSpace="pre-wrap">
                  {expandedCard.fullContent || expandedCard.shortDescription}
                </Text>
              </ModalBody>
              <ModalFooter flexDirection="column" alignItems="stretch" gap={3}>
                {renderCardActions(expandedCard)}
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="gray"
                  alignSelf="flex-end"
                  onClick={() => {
                    handleMoveToHistory(expandedCard);
                    closeExpandedCard();
                  }}
                >
                  Move to history
                </Button>
              </ModalFooter>
            </>
          ) : null}
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ExpandableCards; 