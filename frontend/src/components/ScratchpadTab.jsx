import React from "react";
import { Box, Textarea } from "@chakra-ui/react";
import { useSession } from "../context/SessionContext";

const ScratchpadTab = () => {
  const { sessionId: contextSessionId, setSessionId, scratchpadText, setScratchpadText } = useSession();

  const handleScratchpadChange = async (e) => {
    const newText = e.target.value;
    setScratchpadText(newText);
    try {
      window.dispatchEvent(new Event("scratchpad_updated"));
    } catch (err) {
      console.error("Failed to dispatch scratchpad_updated event:", err);
    }

    if (!contextSessionId && newText.length > 0) {
      try {
        const newSessionId = await window.sessionApi.createSession({
          metadata: {
            userAgent: navigator.userAgent,
            deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? "mobile" : "desktop",
          },
        });
        setSessionId(newSessionId);
        await window.sessionApi.addScratchpadSnapshot(newSessionId, newText);
      } catch (err) {
        console.error("Failed to create session and save initial scratchpad snapshot:", err);
      }
    } else if (contextSessionId && newText.length > 0) {
      // If session already exists, do nothing (snapshotting handled elsewhere)
    }
  };

  return (
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
    </Box>
  );
};

export default ScratchpadTab;

