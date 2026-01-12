import React from "react";
import { Box, HStack, VStack, Text, Slider, SliderTrack, SliderFilledTrack, SliderThumb } from "@chakra-ui/react";
import ToggleCardsButton from "./ToggleCardsButton";

const formatFrequency = (seconds) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};

const CardControls = ({
  showCards,
  onToggleShowCards,
  cardCount,
  spawnFrequency,
  onChangeSpawnFrequency,
  hasSession,
}) => {
  return (
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
        <ToggleCardsButton show={showCards} count={cardCount} onClick={onToggleShowCards} />
        {hasSession && (
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
                  onChange={onChangeSpawnFrequency}
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
  );
};

export default CardControls;

