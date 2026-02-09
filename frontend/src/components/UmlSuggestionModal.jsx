import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Box,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

// very simple line-by-line diff without external dependency
// marks lines present in proposed but not in current as added,
// and lines present in current but not in proposed as removed
const buildLineDiff = (currentText, proposedText) => {
  const currentLines = (currentText || "").split("\n");
  const proposedLines = (proposedText || "").split("\n");

  const maxLen = Math.max(currentLines.length, proposedLines.length);
  const parts = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = currentLines[i];
    const newLine = proposedLines[i];

    if (oldLine === newLine) {
      if (oldLine === undefined) continue;
      parts.push({ value: oldLine + "\n", added: false, removed: false });
    } else {
      if (oldLine !== undefined) {
        parts.push({ value: oldLine + "\n", added: false, removed: true });
      }
      if (newLine !== undefined) {
        parts.push({ value: newLine + "\n", added: true, removed: false });
      }
    }
  }

  return parts;
};

const DiffView = ({ currentText, proposedText }) => {
  const addedBg = useColorModeValue("green.50", "green.900");
  const removedBg = useColorModeValue("red.50", "red.900");
  const neutralBg = useColorModeValue("gray.50", "gray.800");

  const parts = buildLineDiff(currentText, proposedText);

  return (
    <Box
      as="pre"
      fontFamily="monospace"
      fontSize="sm"
      maxH="400px"
      overflowY="auto"
      borderRadius="md"
      border="1px solid"
      borderColor="gray.200"
      p={3}
      bg={neutralBg}
    >
      {parts.map((part, index) => {
        const { added, removed, value } = part;
        const bg = added ? addedBg : removed ? removedBg : "transparent";
        const prefix = added ? "+" : removed ? "-" : " ";

        return (
          <Box key={index} bg={bg} px={2} borderRadius="sm">
            <Text as="span">
              {value.split("\n").map((line, lineIndex, arr) =>
                lineIndex === arr.length - 1 && line === "" ? null : (
                  <Box as="span" key={lineIndex} display="block">
                    {prefix} {line}
                  </Box>
                )
              )}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

const UmlSuggestionModal = ({
  isOpen,
  onClose,
  currentPlantUml,
  proposedPlantUml,
  onAccept,
  isAccepting = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Suggested UML changes</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={3} fontSize="sm" color="gray.600">
            Review the proposed changes to your PlantUML diagram. You can accept to update the
            diagram or reject to keep the current version.
          </Text>
          <DiffView currentText={currentPlantUml} proposedText={proposedPlantUml} />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Reject
          </Button>
          <Button
            colorScheme="purple"
            onClick={onAccept}
            isLoading={isAccepting}
            loadingText="Applying"
          >
            Accept changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UmlSuggestionModal;

