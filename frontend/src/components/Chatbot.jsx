import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Textarea,
  Text,
  IconButton,
  Divider,
  Tooltip,
  useToast,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Flex,
} from '@chakra-ui/react';
import { FaArrowAltCircleRight, FaSync, FaRegCopy, FaThumbsUp, FaThumbsDown, FaRedo, FaTrash } from "react-icons/fa";
import { DownloadIcon } from '@chakra-ui/icons';
import spin from '../assets/spin.png';
import { sessionApi } from '../../api/sessionApi.js';
import { useSession } from '../context/SessionContext';
import { apiUrl } from '../../api/index.jsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import UmlSuggestionModal from "./UmlSuggestionModal.jsx";

const Chatbot = () => {
  const { sessionId, setSessionId, scratchpadText, messages, setMessages } = useSession();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUmlProposalLoadingIndex, setIsUmlProposalLoadingIndex] = useState(null);
  const [umlProposal, setUmlProposal] = useState(null); // { currentPlantUml, proposedPlantUml, messageIndex }
  const [isUmlModalOpen, setIsUmlModalOpen] = useState(false);
  const [isAcceptingUml, setIsAcceptingUml] = useState(false);
  const [feedback, setFeedback] = useState({}); // { messageIndex: 'positive' | 'negative' }
  const [nudgeMessageIndex, setNudgeMessageIndex] = useState(null);
  const [nudgeId, setNudgeId] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const toast = useToast();
  const lastSnapshotRef = React.useRef("");
  const messagesEndRef = React.useRef(null);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Notify nudge system when a regular assistant turn completes
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "assistant" && !last.nudge) {
      try {
        window.dispatchEvent(new Event("chat_turn_completed"));
      } catch (err) {
        console.error("Failed to dispatch chat_turn_completed event:", err);
      }
    }
  }, [messages]);

  // Cleanup session when component unmounts
  useEffect(() => {
    return () => {
      if (sessionId) {
        sessionApi.endSession(sessionId).catch(error => {
          console.error('Failed to end session:', error);
        });
      }
    };
  }, [sessionId]);

  // Update session stats when messages change
  useEffect(() => {
    // Avoid hitting stats with temporary session IDs; wait for real session creation
    if (sessionId && !sessionId.startsWith('temp_') && messages.length > 0) {
      sessionApi.getSessionStats(sessionId)
        .then(stats => setSessionStats(stats))
        .catch(error => console.error('Failed to get session stats:', error));
    }
  }, [sessionId, messages.length]);

  const sendMessage = () => {
    if (!input.trim() && !scratchpadText.trim()) return;
    
    // Clear input immediately for better UX
    const currentInput = input;
    setInput("");
    
    // Add user message immediately (synchronous UI update)
    const userMessage = { role: "user", content: currentInput };
    setMessages(prev => [...prev, userMessage]);
    
    // Start loading state immediately
    setIsLoading(true);
    
    // Create a temporary session ID immediately for card spawning
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      // Create a temporary session ID to trigger card spawning immediately
      const tempSessionId = `temp_${Date.now()}`;
      setSessionId(tempSessionId);
      currentSessionId = tempSessionId;
      console.log('Temporary session created for immediate card spawning:', tempSessionId);
    }
    
    // Handle all async operations in the background
    const handleAsyncOperations = async () => {
      // Create real session first if this is the first message
      if (currentSessionId.startsWith('temp_')) {
        try {
          const newSessionId = await sessionApi.createSession({
            metadata: {
              userAgent: navigator.userAgent,
              deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop'
            }
          });
          setSessionId(newSessionId);
          currentSessionId = newSessionId;
          console.log('Real session created:', newSessionId);
        } catch (error) {
          console.error('Failed to create session:', error);
          // If session creation fails, continue without session tracking
          currentSessionId = null;
        }
      }
      
      try {
        // Send chat request with real session ID
        const response = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            messages: [...messages, userMessage],
            sessionId: currentSessionId 
          }),
        });
        
        if (!response.ok) throw new Error("Failed to fetch response from the chatbot");
        
        const data = await response.json();
        const assistantMessage = {
          role: "assistant",
          content: data.choices[0].message.content,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Error:", error);
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong." },
        ]);
      } finally {
        setIsLoading(false);
      }

      // Save scratchpad snapshot in background (non-blocking)
      if (scratchpadText && scratchpadText !== lastSnapshotRef.current && currentSessionId) {
        try {
          await sessionApi.addScratchpadSnapshot(currentSessionId, scratchpadText);
          lastSnapshotRef.current = scratchpadText;
        } catch (err) {
          console.error('Failed to save scratchpad snapshot:', err);
        }
      }
    };

    // Start async operations without blocking the UI
    handleAsyncOperations();
  };

  const fetchRandomNudge = async () => {
    // Create session if this is the first interaction
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        currentSessionId = await sessionApi.createSession({
          metadata: {
            userAgent: navigator.userAgent,
            deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop'
          }
        });
        setSessionId(currentSessionId);
        console.log('Session created for nudge:', currentSessionId);
      } catch (error) {
        console.error('Failed to create session for nudge:', error);
        // Continue without session tracking if session creation fails
      }
    }
    
    try {
      const avoidTopics = Array.from(
        new Set(
          messages
            .filter((m) => m && m.nudge && m.nudgeMeta && m.nudgeMeta.topic)
            .map((m) => String(m.nudgeMeta.topic).toLowerCase().trim())
            .filter(Boolean)
        )
      ).slice(-20);

      const body = {
        sessionId: currentSessionId || null,
        scratchpadText,
        shownNudgeIds: [], // chat-based nudges don't track IDs yet
        messages: messages.filter((m) => m.role !== "assistant" || !m.nudge),
        trigger: "manual_chat",
        avoidTopics,
      };

      const response = await fetch(apiUrl("/api/smart"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to fetch nudge");
      const data = await response.json();

      let nudges = [];
      if (data && Array.isArray(data.nudges)) {
        nudges = data.nudges;
      } else if (data && data.text) {
        nudges = [
          {
            id: data._id,
            text: data.text,
            goal: data.goal || "unspecified",
            topic: data.category || data.topic || "unspecified",
          },
        ];
      }

      if (!nudges.length) {
        console.log("No nudges returned for manual_chat trigger");
        return;
      }

      const first = nudges[0];
      const nudgeMsg = {
        role: "assistant",
        content: first.text,
        nudge: true,
        nudgeId: first.id || null,
        nudgeMeta: {
          phase: data.phase || null,
          goal: first.goal || null,
          topic: first.topic || null,
        },
      };
      setMessages((prev) => [...prev, nudgeMsg]);
    } catch (error) {
      console.error("Error fetching nudge:", error);
    }
  };

  const handleFeedback = async (messageIndex, type) => {
    if (!sessionId) {
      toast({
        title: "No active session",
        description: "Please send a message first to start tracking feedback",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }
    
    try {
      // Update feedback in session
      await sessionApi.updateFeedback(sessionId, messageIndex, type);
      
      // Update local feedback state
      setFeedback((prev) => ({ ...prev, [messageIndex]: type }));
      
      // Show success toast
      toast({
        title: "Feedback submitted!",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Failed to submit feedback",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    }
  };

  const handleSpin = async (assistantIndex, isNudge) => {
    // Track spin interaction if session exists
    if (sessionId) {
      try {
        const action = isNudge ? 'new_nudge' : 'regenerate';
        await sessionApi.addSpinInteraction(sessionId, assistantIndex, action);
      } catch (error) {
        console.error('Error tracking spin interaction:', error);
        // Continue with the action even if tracking fails
      }
    }

    if (isNudge) {
      // Fetch a new random nudge
      try {
        const url = sessionId 
          ? apiUrl(`/api/random?sessionId=${sessionId}`)
          : apiUrl("/api/random");
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch nudge");
        const data = await response.json();
        const nudgeMsg = { role: "assistant", content: data.text, nudge: true };
        setMessages((prev) => [...prev, nudgeMsg]);
      } catch (error) {
        console.error("Error fetching nudge:", error);
      }
      return;
    }
    // Otherwise, re-answer the user's last question
    let userMessage = null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMessage = messages[i];
        break;
      }
    }
    if (!userMessage) return;
    setIsLoading(true);
    const updatedMessages = [...messages, { role: "user", content: userMessage.content }];
    setMessages(updatedMessages);
    try {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: updatedMessages,
          sessionId: sessionId 
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch response from the chatbot");
      const data = await response.json();
      const assistantMessage = {
        role: "assistant",
        content: data.choices[0].message.content,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  // Render markdown with proper styling for assistant messages
  const renderMarkdown = (content) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <Text mb={2}>{children}</Text>,
          h1: ({ children }) => <Text as="h1" fontSize="2xl" fontWeight="bold" color="purple.600" mb={2}>{children}</Text>,
          h2: ({ children }) => <Text as="h2" fontSize="xl" fontWeight="bold" color="purple.600" mb={2}>{children}</Text>,
          h3: ({ children }) => <Text as="h3" fontSize="lg" fontWeight="bold" color="purple.600" mb={2}>{children}</Text>,
          h4: ({ children }) => <Text as="h4" fontSize="md" fontWeight="bold" color="purple.600" mb={2}>{children}</Text>,
          ul: ({ children }) => <Box as="ul" pl={4} mb={2} style={{ listStylePosition: 'inside' }}>{children}</Box>,
          ol: ({ children }) => <Box as="ol" pl={4} mb={2} style={{ listStylePosition: 'inside' }}>{children}</Box>,
          li: ({ children }) => <Box as="li" mb={1}>{children}</Box>,
          strong: ({ children }) => <Text as="strong" fontWeight="bold">{children}</Text>,
          em: ({ children }) => <Text as="em" fontStyle="italic">{children}</Text>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <Box as="code" bg="gray.100" px={1} py={0.5} borderRadius="sm" fontSize="0.9em">{children}</Box>
            ) : (
              <Box as="pre" bg="gray.100" p={3} borderRadius="md" overflowX="auto" mb={2}>
                <Text as="code" fontSize="0.85em">{children}</Text>
              </Box>
            );
          },
          a: ({ href, children }) => (
            <Box as="a" href={href} color="blue.500" textDecoration="underline" target="_blank" rel="noopener noreferrer">
              {children}
            </Box>
          ),
          blockquote: ({ children }) => (
            <Box as="blockquote" borderLeft="4px solid" borderColor="purple.400" pl={4} mb={2} fontStyle="italic">
              {children}
            </Box>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
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

  // Clear chat handler
  const handleClearChat = () => {
    setMessages([]);
    setFeedback({});
    toast({
      title: "Chat cleared",
      description: "All messages have been removed from the chat",
      status: "success",
      duration: 2000,
      isClosable: true,
      position: "top",
    });
  };

  const ensureRealSessionId = async () => {
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      try {
        const newSessionId = await sessionApi.createSession({
          metadata: {
            userAgent: navigator.userAgent,
            deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
          },
        });
        currentSessionId = newSessionId;
        setSessionId(newSessionId);
      } catch (error) {
        console.error("Failed to create session:", error);
        toast({
          title: "Unable to create session",
          description: "UML updates require a session; try again in a moment.",
          status: "error",
          duration: 3000,
          isClosable: true,
          position: "top",
        });
        return null;
      }
    }

    return currentSessionId;
  };

  const handleProposeUmlFromChat = async (messageIndex) => {
    if (!messages || messages.length === 0) {
      toast({
        title: "No messages yet",
        description: "Start a conversation before updating the UML diagram.",
        status: "info",
        duration: 2500,
        isClosable: true,
        position: "top",
      });
      return;
    }

    const currentSessionId = await ensureRealSessionId();
    if (!currentSessionId) return;

    try {
      setIsUmlProposalLoadingIndex(messageIndex);

      const response = await fetch(apiUrl("/api/uml/from-chat/propose"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          messages,
          messageIndex,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to propose UML from chat");
      }

      const data = await response.json();
      setUmlProposal({
        currentPlantUml: data.currentPlantUml,
        proposedPlantUml: data.proposedPlantUml,
        messageIndex,
      });
      setIsUmlModalOpen(true);
    } catch (error) {
      console.error("Error proposing UML from chat:", error);
      toast({
        title: "Failed to propose UML",
        description: error.message || "An error occurred while preparing UML changes.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsUmlProposalLoadingIndex(null);
    }
  };

  return (
    <Box display="flex" flexDirection="column" height="100%" width="100%" bg="#F6F8FA" position="relative" overflow="hidden">
      <Box display="flex" position="relative" zIndex={2} flexShrink={0}>
        <Box position="relative" display="inline-block" width="100%">
          <Flex align="center" justify="space-between" bg="white" px={8} py={2} position="relative" zIndex={2} width="100%">
            <Text as="h2" fontWeight="bold" fontSize="lg" color="gray.800">
              Chat
            </Text>
            <HStack spacing={2}>
              <Button leftIcon={<FaTrash />} colorScheme="red" variant="outline" size="sm" onClick={handleClearChat}>
                Clear
              </Button>
              <Button leftIcon={<DownloadIcon />} colorScheme="gray" variant="outline" size="sm" onClick={handleSave}>
                Save
              </Button>
            </HStack>
          </Flex>
         
        </Box>
      </Box>
      <Box
        flex="1"
        mx="auto"
        width="100%"
        bg="#F6F8FA"
        boxShadow="sm"
        border="1px solid"
        borderColor="gray.200"
        display="flex"
        flexDirection="column"
        minHeight={0}
        overflow="hidden"
        pt={8}
      >
        <VStack 
          flex="1" 
          overflowY="auto" 
          spacing={4} 
          px={6} 
          py={4} 
          align="stretch"
          minHeight={0} // Important: allows scrolling
          maxHeight="100%" // Constrain height
        >
          {messages.map((message, index) => (
            <Box key={index}>
              <Box
                alignSelf={message.role === "user" ? "flex-end" : "flex-start"}
                bg={
                  message.role === "user"
                    ? "#7B1EA2E5"
                    : message.nudge
                      ? "rgba(255, 244, 128, 0.4)"
                      : "gray.100"
                }
                color={message.role === "user" ? "white" : "gray.800"}
                p={3}
                borderRadius="lg"
                maxWidth="80%"
                boxShadow={message.role === "assistant" ? "md" : undefined}
                border={message.role === "assistant" ? "1px solid #e2e8f0" : undefined}
                fontSize="md"
                fontWeight={message.role === "user" ? "medium" : "normal"}
                mb={1}
                position="relative"
                ml={message.role === "assistant" ? 0 : "auto"}
                mr={message.role === "user" ? 0 : "auto"}
              >
                {message.role === "assistant" ? (
                  <>
                    {renderMarkdown(message.content)}
                    {message.umlSvg && (
                      <Box
                        mt={3}
                        borderRadius="md"
                        overflow="hidden"
                        bg="white"
                        border="1px solid"
                        borderColor="gray.200"
                        p={2}
                      >
                        <Box
                          as="div"
                          dangerouslySetInnerHTML={{ __html: message.umlSvg }}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  message.content
                )}
                <Tooltip label="Copy" hasArrow>
                  <IconButton
                    icon={<FaRegCopy />}
                    aria-label="Copy message"
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    position="absolute"
                    color={message.role === "user" ? "white" :"gray.800"}
                    top={2}
                    right={2}
                    onClick={() => handleCopy(message.content)}
                  />
                </Tooltip>
              </Box>
              {message.role === "assistant" && (
                <HStack spacing={3} mt={2} ml={2} mr={"auto"}>
                  <Tooltip label="Like" hasArrow>
                    <IconButton
                      icon={<FaThumbsUp size={18} />}
                      aria-label="Like"
                      variant="ghost"
                      onClick={() => handleFeedback(index, 'positive')}
                      color={feedback[index] === 'positive' ? 'green.500' : 'gray.400'}
                      _hover={{ 
                        bg: 'gray.100',
                        color: feedback[index] === 'positive' ? 'green.600' : 'gray.500'
                      }}
                      borderRadius="full"
                      size="sm"
                      minW="auto"
                      h="auto"
                      p={1}
                    />
                  </Tooltip>
                  <Tooltip label="Dislike" hasArrow>
                    <IconButton
                      icon={<FaThumbsDown size={18} />}
                      aria-label="Dislike"
                      variant="ghost"
                      onClick={() => handleFeedback(index, 'negative')}
                      color={feedback[index] === 'negative' ? 'red.500' : 'gray.400'}
                      _hover={{ 
                        bg: 'gray.100',
                        color: feedback[index] === 'negative' ? 'red.600' : 'gray.500'
                      }}
                      borderRadius="full"
                      size="sm"
                      minW="auto"
                      h="auto"
                      p={1}
                    />
                  </Tooltip>
                  <Tooltip label="Regenerate" hasArrow>
                    <IconButton
                      icon={<FaRedo size={18} />}
                      aria-label="Regenerate"
                      variant="ghost"
                      onClick={() => handleSpin(index, message.nudge)}
                      color="gray.400"
                      _hover={{ 
                        bg: 'gray.100',
                        color: 'gray.500'
                      }}
                      borderRadius="full"
                      size="sm"
                      minW="auto"
                      h="auto"
                      p={1}
                    />
                  </Tooltip>
                  <Tooltip label="Update UML from this chat" hasArrow>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="purple"
                      onClick={() => handleProposeUmlFromChat(index)}
                      isLoading={isUmlProposalLoadingIndex === index}
                    >
                      Update UML
                    </Button>
                  </Tooltip>
                </HStack>
              )}
            </Box>
          ))}
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </VStack>
        {umlProposal && (
          <UmlSuggestionModal
            isOpen={isUmlModalOpen}
            onClose={() => setIsUmlModalOpen(false)}
            currentPlantUml={umlProposal.currentPlantUml}
            proposedPlantUml={umlProposal.proposedPlantUml}
            onAccept={async () => {
              if (!umlProposal || !umlProposal.proposedPlantUml) return;

              const currentSessionId = await ensureRealSessionId();
              if (!currentSessionId) return;

              try {
                setIsAcceptingUml(true);
                const response = await fetch(apiUrl("/api/uml/from-chat/accept"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: currentSessionId,
                    proposedPlantUml: umlProposal.proposedPlantUml,
                    messageIndex: umlProposal.messageIndex,
                    summary: "Accepted UML update from chat",
                  }),
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(errorData.error || "Failed to accept UML changes");
                }

                const data = await response.json();
                const updatedPlantuml = data.plantuml;
                const history = data.history || {};

                if (updatedPlantuml) {
                  sessionStorage.setItem("plantuml_code", updatedPlantuml);
                }

                // Persist latest UML history state so PlantUmlTab can pick it up
                sessionStorage.setItem(
                  "plantuml_history_state",
                  JSON.stringify({
                    canUndo: !!history.canUndo,
                    canRedo: !!history.canRedo,
                    hasHistory: !!history.hasHistory,
                    revisionIndex:
                      typeof history.revisionIndex === "number" ? history.revisionIndex : -1,
                  })
                );

                // Notify other components (e.g., PlantUmlTab) that UML + history changed
                window.dispatchEvent(new Event("plantuml_updated"));

                setIsUmlModalOpen(false);

                toast({
                  title: "UML updated",
                  description: "The UML diagram has been updated with the accepted changes.",
                  status: "success",
                  duration: 2500,
                  isClosable: true,
                  position: "top",
                });
              } catch (error) {
                console.error("Error accepting UML changes:", error);
                toast({
                  title: "Failed to accept UML changes",
                  description: error.message || "An error occurred while applying UML changes.",
                  status: "error",
                  duration: 3000,
                  isClosable: true,
                  position: "top",
                });
              } finally {
                setIsAcceptingUml(false);
              }
            }}
            isAccepting={isAcceptingUml}
          />
        )}
        {/* Input area */}
        <HStack px={6} pb={6} pt={6} spacing={3} bg="#F6F8FA" flexShrink={0}>
          <Tooltip label="Spin for nudge" hasArrow>
            <IconButton
              icon={<img src={spin} alt="Spin" width={20} height={20} style={{ display: 'inline-block' }} />}
              aria-label="Spin for nudge"
              color="white"
              _hover={{ bg: "#7B1EA2E5" }}
              onClick={fetchRandomNudge}
              borderRadius="full"
              boxSize={10}
              minW={0}
              p={0}
            />
          </Tooltip>
          <Box flex="1" bg="white" px={4} py={2} display="flex" alignItems="center" boxShadow="sm">
            <Textarea
              placeholder="Message"
              flex="1"
              resize="none"
              rows={1}
              overflowY="auto"
              variant="unstyled"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              px={0}
              py={1}
              minH="40px"
              maxH="80px"
            />
            <IconButton
              icon={<FaArrowAltCircleRight size={24} />}
              aria-label="Send"
              bg="#7B1EA2E5"
              color="white"
              _hover={{ bg: "#7B1EA2E5" }}
              borderRadius="full"
              ml={2}
              onClick={sendMessage}
              isLoading={isLoading}
              minW={0}
              boxSize={10}
              p={0}
            />
          </Box>
        </HStack>
      </Box>
    </Box>
  );
};

export default Chatbot;