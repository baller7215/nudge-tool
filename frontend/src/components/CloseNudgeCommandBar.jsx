import React from "react";
import { Box, Button, Collapse, HStack, Text, useToast } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useSession } from "../context/SessionContext";
import {
  normalizeNudgeDisplayId,
  parseCloseNudgeCommands,
} from "../utils/parseCloseNudgeCommands.js";

const popIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const CloseNudgeCommandBar = ({ cards = [], onToggleNudgeCompletionByDisplayId }) => {
  const { scratchpadText } = useSession();
  const [pendingConfirmById, setPendingConfirmById] = React.useState({});
  const toast = useToast();

  const closeCommandTargets = React.useMemo(
    () => parseCloseNudgeCommands(scratchpadText),
    [scratchpadText],
  );

  const cardsById = React.useMemo(() => {
    const map = new Map();
    cards.forEach((card) => {
      if (!card?.displayId) return;
      map.set(normalizeNudgeDisplayId(card.displayId), card);
    });
    return map;
  }, [cards]);

  React.useEffect(() => {
    const active = new Set(closeCommandTargets);
    setPendingConfirmById((prev) => {
      const next = {};
      let changed = false;
      Object.keys(prev).forEach((id) => {
        if (active.has(id)) next[id] = prev[id];
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [closeCommandTargets]);

  const handleCloseCommandClick = async (displayId) => {
    const card = cardsById.get(displayId);
    if (!card) return;

    if (!pendingConfirmById[displayId]) {
      setPendingConfirmById((prev) => ({ ...prev, [displayId]: true }));
      return;
    }

    if (onToggleNudgeCompletionByDisplayId) {
      const nextStatus = await onToggleNudgeCompletionByDisplayId(displayId);
      if (nextStatus) {
        const label = nextStatus === "completed" ? "closed" : "reopened";
        toast({
          title: `Nudge #${displayId} ${label}`,
          description: card.title ? `${card.title} is now ${nextStatus}.` : undefined,
          status: "success",
          duration: 2200,
          position: "top",
          isClosable: true,
        });
      }
    }
    setPendingConfirmById((prev) => ({ ...prev, [displayId]: false }));
  };

  const dismissClosePrompt = (displayId) => {
    setPendingConfirmById((prev) => ({ ...prev, [displayId]: false }));
  };

  return (
    <Collapse in={closeCommandTargets.length > 0} animateOpacity unmountOnExit>
      <Box
        flexShrink={0}
        borderTopWidth="1px"
        borderColor="pink.100"
        bg="pink.50"
        px={4}
        py={2}
      >
        {closeCommandTargets.map((displayId) => {
          const card = cardsById.get(displayId);
          const status = card?.status || "active";
          const isPending = Boolean(pendingConfirmById[displayId]);
          const isCompleted = status === "completed";
          const intentLabel = isCompleted ? "reopen" : "close";

          return (
            <HStack
              key={displayId}
              justify="space-between"
              align="center"
              gap={3}
              py={1}
              animation={`${popIn} 0.22s ease-out`}
              _notLast={{ mb: 1 }}
            >
              <Box flex="1" minW={0}>
                <Text fontSize="sm" fontWeight="semibold" color="gray.800" noOfLines={1}>
                  {card ? (
                    <>
                      <Text as="span" color="purple.600">
                        #{displayId}
                      </Text>
                      {card.title ? ` · ${card.title}` : ""}
                    </>
                  ) : (
                    <>Unknown nudge #{displayId}</>
                  )}
                </Text>
                <Text fontSize="xs" color="gray.600" noOfLines={1}>
                  {card
                    ? isPending
                      ? `Confirm to ${intentLabel} this nudge`
                      : `closes nudge #${displayId} detected`
                    : "No matching nudge in this session"}
                </Text>
              </Box>
              <HStack spacing={2} flexShrink={0}>
                {isPending ? (
                  <Button size="xs" variant="ghost" onClick={() => dismissClosePrompt(displayId)}>
                    Cancel
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  colorScheme={card ? (isCompleted ? "blue" : "pink") : "orange"}
                  variant={isPending ? "solid" : "outline"}
                  onClick={() => handleCloseCommandClick(displayId)}
                  isDisabled={!card}
                >
                  {isPending
                    ? `Confirm ${intentLabel}`
                    : isCompleted
                      ? `Reopen #${displayId}`
                      : `Close #${displayId}`}
                </Button>
              </HStack>
            </HStack>
          );
        })}
      </Box>
    </Collapse>
  );
};

export default CloseNudgeCommandBar;
