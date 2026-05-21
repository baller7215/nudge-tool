import { Box, HStack, Text, Slider, SliderTrack, SliderFilledTrack, SliderThumb } from "@chakra-ui/react";
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
      px={3}
      py={2}
      borderTop="1px solid"
      borderColor="gray.200"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexShrink={0}
    >
      <HStack spacing={3} align="center" flexWrap="wrap">
        <ToggleCardsButton show={showCards} count={cardCount} onClick={onToggleShowCards} />
        {hasSession && (
          <HStack spacing={2} align="center">
            <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
              Nudge frequency
            </Text>
            <Text fontSize="xs" color="gray.600" minW="48px" fontWeight="medium">
              {formatFrequency(spawnFrequency)}
            </Text>
            <Box minW="140px" maxW="220px" w="180px">
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
        )}
      </HStack>
    </Box>
  );
};

export default CardControls;

