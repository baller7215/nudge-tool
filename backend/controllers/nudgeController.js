import { Nudge } from '../models/NudgeModel.js';
import sessionService from '../services/sessionService.js';
import { runNudgeGraph } from '../services/nudgeGraph.js';

export const getRandomNudge = async (req, res) => {
    const { sessionId } = req.query;
    
    try {
        // Get a random nudge from the database
        const nudge = await Nudge.aggregate([
            { $sample: { size: 1 } }
        ]);

        if (!nudge || nudge.length === 0) {
            return res.status(404).json({ error: 'No nudges found' });
        }

        // Increment the usage count
        await Nudge.findByIdAndUpdate(nudge[0]._id, {
            $inc: { usageCount: 1 }
        });

        // If sessionId is provided, track the nudge in the session
        if (sessionId) {
            try {
                await sessionService.addMessage(sessionId, {
                    role: 'assistant',
                    content: nudge[0].text,
                    timestamp: new Date(),
                    isNudge: true,
                    nudgeId: nudge[0]._id,
                    responseTime: null,
                    tokensUsed: 0
                });
            } catch (sessionError) {
                console.error('Error tracking nudge in session:', sessionError);
                // Don't fail the main request if session tracking fails
            }
        }

        res.json(nudge[0]);
    } catch (error) {
        console.error('Error getting random nudge:', error);
        res.status(500).json({ error: 'Failed to get random nudge' });
    }
};

export const getSmartNudgeRecommendation = async (req, res) => {
    const {
        sessionId,
        scratchpadText,
        messages,
        shownNudgeIds,
        plantuml,
        umlSummary,
        trigger,
        avoidTopics,
        latestUserInput,
        message: explicitMessage,
        cooldownSeconds,
    } = req.body || {};
    
    try {
        const realSessionId = sessionId || null;
        const now = Date.now();
        const cooldownMs = Number(cooldownSeconds ?? 60) * 1000;

        // Cooldown: do nothing if we nudged too recently.
        if (realSessionId) {
            try {
                const session = await sessionService.getSession(realSessionId);
                const sessionMessages = Array.isArray(session?.messages) ? session.messages : [];
                const lastNudge = [...sessionMessages]
                    .reverse()
                    .find((m) => m && m.isNudge && m.timestamp);

                if (lastNudge?.timestamp) {
                    const ts = new Date(lastNudge.timestamp).getTime();
                    if (!Number.isNaN(ts) && now - ts < cooldownMs) {
                        return res.json({ nudges: [], phase: null, trigger: trigger || null, umlSummary: null });
                    }
                }
            } catch {
                // If cooldown check fails, fall through to generate.
            }
        }

        const session = realSessionId ? await sessionService.getSession(realSessionId).catch(() => null) : null;
        const plantumlCode =
            typeof plantuml === 'string'
                ? plantuml
                : typeof session?.getUmlState === 'function'
                  ? session.getUmlState().plantumlCode
                  : '';

        const scratch = typeof scratchpadText === 'string' ? scratchpadText : '';

        const messagesArr = Array.isArray(messages) ? messages : [];
        const lastUser = [...messagesArr].reverse().find((m) => m?.role === 'user' && String(m?.content || '').trim());
        const messageForNudge =
            String(explicitMessage ?? latestUserInput ?? lastUser?.content ?? '').trim();

        const workspace =
            `Scratchpad:\n${scratch}\n\nPlantUML:\n${plantumlCode || ''}`.trim();

        const result = await runNudgeGraph({
            sessionId: realSessionId,
            trigger: trigger || null,
            message: messageForNudge,
            workspace,
        });

        if (!Array.isArray(result.nudges) || result.nudges.length === 0 || result.action === 'none') {
            return res.json({
                nudges: [],
                phase: null,
                trigger: trigger || null,
                umlSummary: null,
            });
        }

        const mode = result.mode || 'reflect';
        const nudgeText = String(result.nudges[0] || '').trim();
        if (!nudgeText) {
            return res.json({
                nudges: [],
                phase: null,
                trigger: trigger || null,
                umlSummary: null,
            });
        }

        const nudgeDoc = await Nudge.create({
            text: nudgeText,
            category: mode,
        });

        if (realSessionId) {
            try {
                await sessionService.addMessage(realSessionId, {
                    role: 'assistant',
                    content: nudgeText,
                    timestamp: new Date(),
                    isNudge: true,
                    nudgeId: String(nudgeDoc._id),
                    responseTime: null,
                    tokensUsed: 0,
                });
            } catch (sessionError) {
                console.error('Error tracking smart nudge in session:', sessionError);
            }
        }

        res.json({
            nudges: [
                {
                    id: String(nudgeDoc._id),
                    text: nudgeDoc.text,
                    goal: mode,
                    topic: mode,
                },
            ],
            phase: result.action || null,
            trigger: trigger || null,
            umlSummary: null,
            nudgeReason: result.reason || null,
        });
    } catch (error) {
        console.error('Error getting smart nudge:', error);
        res.status(500).json({ error: 'Failed to get smart nudge' });
    }
};

export const updateFeedback = async (req, res) => {
    const { nudgeId } = req.params;
    const { feedbackType } = req.body; // 'positive' or 'negative'

    try {
        const updateField = feedbackType === 'positive' ? 'positiveFeedback' : 'negativeFeedback';
        
        const updatedNudge = await Nudge.findByIdAndUpdate(
            nudgeId,
            { $inc: { [updateField]: 1 } },
            { new: true }
        );

        if (!updatedNudge) {
            return res.status(404).json({ error: 'Nudge not found' });
        }

        res.json(updatedNudge);
    } catch (error) {
        console.error('Error updating feedback:', error);
        res.status(500).json({ error: 'Failed to update feedback' });
    }
}; 