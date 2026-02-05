import sessionService from '../services/sessionService.js';
import { generateUmlFromChat } from '../services/umlFromChatService.js';
import { renderPlantUmlToSvg } from '../services/plantumlService.js';

/**
 * POST /api/uml/from-chat
 * Body: { sessionId, messages }
 *
 * - Loads existing UML state for the session (or default skeleton)
 * - Calls LLM to get incremental UML update
 * - Persists updated UML on the session
 * - Renders SVG via PlantUML service
 * - Returns { plantuml, svg } to the client
 */
export const generateFromChat = async (req, res) => {
  const { sessionId, messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    // Load or create the session
    let session = null;
    if (sessionId) {
      session = await sessionService.getSession(sessionId);
    }

    // If no session exists but a sessionId was given, we do not auto-create
    // to avoid mismatched IDs. Client should ensure real session creation.
    if (!session && sessionId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fallback if no sessionId was provided: work without persistence
    const hasPersistentSession = !!session;

    const currentPlantUml = hasPersistentSession
      ? session.getUmlState().plantumlCode
      : '@startuml\n@enduml';

    const newPlantUml = await generateUmlFromChat({
      sessionId: sessionId || 'no-session',
      messages,
      currentPlantUml,
    });

    let savedPlantUml = newPlantUml;

    // Persist UML state if we have a real session
    if (hasPersistentSession) {
      const updated = await session.setUmlState({
        umlType: 'class',
        plantumlCode: newPlantUml,
      });
      savedPlantUml = updated.umlState.plantumlCode;
    }

    // Render SVG via PlantUML proxy
    let svg = null;
    try {
      svg = await renderPlantUmlToSvg(savedPlantUml);
    } catch (renderError) {
      console.error('Failed to render UML to SVG from chat:', renderError);
      // We still return the PlantUML text so the client can show or debug it
    }

    return res.json({
      plantuml: savedPlantUml,
      svg,
    });
  } catch (error) {
    console.error('Error generating UML from chat:', error);
    return res.status(500).json({
      error: 'Failed to generate UML from chat',
    });
  }
};

