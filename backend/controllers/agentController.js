import sessionService from "../services/sessionService.js";
import { getChatCompletion } from "../services/chatService.js";
import { generateNudges } from "../services/nudgeService.js";

const stripNudgeMessagesForChat = (messages = []) => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((m) => m && !(m.role === "assistant" && m.nudge))
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.trim() : "",
    }))
    .filter((m) => m.role && typeof m.content === "string" && m.content.length > 0);
};

const extractAvoidTopics = (messages = []) => {
  if (!Array.isArray(messages)) return [];

  const topics = messages
    .filter((m) => m && m.nudge && m.nudgeMeta && m.nudgeMeta.topic)
    .map((m) => String(m.nudgeMeta.topic).toLowerCase().trim())
    .filter(Boolean);

  // de-dupe and cap to keep the prompt small
  return Array.from(new Set(topics)).slice(-20);
};

export const postAgentChatAndNudges = async (req, res) => {
  const { messages, sessionId, scratchpadText, trigger } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const effectiveTrigger = trigger || "chat_message";
  const scratchpad = scratchpadText || "";
  const incomingMessages = messages;

  try {
    // 1) Chat completion on the "real" chat transcript (no nudge pseudo-messages)
    const chatMessages = stripNudgeMessagesForChat(incomingMessages);
    const hasUserMessage = chatMessages.some((m) => m.role === "user");

    if (!hasUserMessage) {
      return res.status(400).json({
        error: "No non-empty user message found for chat completion",
      });
    }

    const startTime = Date.now();
    const completion = await getChatCompletion(chatMessages);
    const responseTime = Date.now() - startTime;

    const assistantContent = completion?.choices?.[0]?.message?.content || "";

    // 2) Persist chat turn + generated nudge (best-effort; never fail the request)
    if (sessionId) {
      try {
        const lastUserMessage = [...incomingMessages]
          .reverse()
          .find((m) => m && m.role === "user");

        if (lastUserMessage && typeof lastUserMessage.content === "string") {
          await sessionService.addMessage(sessionId, {
            role: "user",
            content: lastUserMessage.content,
            timestamp: new Date(),
            responseTime: null,
            tokensUsed: 0,
          });
        }

        if (assistantContent) {
          await sessionService.addMessage(sessionId, {
            role: "assistant",
            content: assistantContent,
            timestamp: new Date(),
            responseTime,
            tokensUsed: completion?.usage?.total_tokens || 0,
            model: completion?.model || "gpt-3.5-turbo",
          });
        }
      } catch (sessionError) {
        console.error("Error tracking session for agent:", sessionError);
      }
    }

    // 3) Generate nudges using your existing nudge pipeline
    const avoidTopics = extractAvoidTopics(incomingMessages);

    const nudgeResult = await generateNudges({
      sessionId: sessionId || null,
      scratchpadText: scratchpad,
      messages: chatMessages,
      trigger: effectiveTrigger,
      avoidTopics,
    });

    const nudges = Array.isArray(nudgeResult?.nudges) ? nudgeResult.nudges : [];

    // Track only the first nudge in the session (matches your existing behavior)
    if (sessionId && nudges.length > 0) {
      try {
        const first = nudges[0];
        await sessionService.addMessage(sessionId, {
          role: "assistant",
          content: first.text,
          timestamp: new Date(),
          isNudge: true,
          nudgeId: first.id || null,
          responseTime: null,
          tokensUsed: 0,
        });
      } catch (sessionError) {
        console.error("Error tracking nudge in session for agent:", sessionError);
      }
    }

    return res.json({
      assistantContent,
      nudges,
      phase: nudgeResult?.phase,
      trigger: nudgeResult?.trigger || effectiveTrigger,
      umlSummary: nudgeResult?.umlSummary || null,
    });
  } catch (error) {
    console.error("Agent orchestration error:", error);
    return res.status(500).json({ error: "Failed to run agent" });
  }
};

