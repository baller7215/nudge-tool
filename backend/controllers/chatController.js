// controllers/chatController.js
import { getChatCompletion } from "../services/chatService.js";
import sessionService from "../services/sessionService.js";

export const getChatCompletionAbstract = async (req, res) => {
    const { messages, sessionId } = req.body;

    try {
        const startTime = Date.now();
        const completion = await getChatCompletion(messages);
        const responseTime = Date.now() - startTime;

        // If sessionId is provided, track the conversation
        if (sessionId) {
            try {
                // Add user message to session
                const lastUserMessage = messages[messages.length - 1];
                const lastUserContent = String(lastUserMessage?.content ?? '').trim();
                if (lastUserMessage && lastUserMessage.role === 'user' && lastUserContent) {
                    await sessionService.addMessage(sessionId, {
                        role: 'user',
                        content: lastUserContent,
                        timestamp: new Date(),
                        responseTime: null,
                        tokensUsed: 0 // Could be calculated if needed
                    });
                }

                // Add assistant response to session
                if (completion.choices && completion.choices[0]) {
                    const assistantContent = String(completion?.choices?.[0]?.message?.content ?? '').trim();
                    if (assistantContent) {
                        await sessionService.addMessage(sessionId, {
                            role: 'assistant',
                            content: assistantContent,
                            timestamp: new Date(),
                            responseTime: responseTime,
                            tokensUsed: completion.usage?.total_tokens || 0,
                            model: completion.model || 'gpt-3.5-turbo'
                        });
                    }
                }
            } catch (sessionError) {
                console.error('Error tracking session:', sessionError);
                // Don't fail the main request if session tracking fails
            }
        }

        res.json(completion);
    } catch (error) {
        console.error('Chat completion error:', error);
        res.status(500).json({ error: 'Failed to get chat completion' });
    }
};
