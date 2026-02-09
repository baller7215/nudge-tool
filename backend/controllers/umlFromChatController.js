import sessionService from '../services/sessionService.js';
import { generateUmlFromChat } from '../services/umlFromChatService.js';
import { renderPlantUmlToSvg } from '../services/plantumlService.js';

/**
 * Helper to load the current PlantUML for a session (or a default skeleton).
 */
const getCurrentPlantUmlForSession = async (sessionId) => {
  if (!sessionId) {
    return {
      session: null,
      hasPersistentSession: false,
      currentPlantUml: '@startuml\n@enduml',
    };
  }

  const session = await sessionService.getSession(sessionId);

  if (!session) {
    return {
      session: null,
      hasPersistentSession: false,
      currentPlantUml: '@startuml\n@enduml',
    };
  }

  const umlState = session.getUmlState();

  return {
    session,
    hasPersistentSession: true,
    currentPlantUml: umlState.plantumlCode || '@startuml\n@enduml',
  };
};

/**
 * POST /api/uml/from-chat/propose
 * Body: { sessionId, messages }
 *
 * - Loads existing UML state for the session (or default skeleton)
 * - Calls LLM to get incremental UML update
 * - DOES NOT persist the UML
 * - Returns { currentPlantUml, proposedPlantUml }
 */
export const proposeFromChat = async (req, res) => {
  const { sessionId, messages, messageIndex, summary } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const { currentPlantUml } = await getCurrentPlantUmlForSession(sessionId);

    const proposedPlantUml = await generateUmlFromChat({
      sessionId: sessionId || 'no-session',
      messages,
      currentPlantUml,
    });

    return res.json({
      currentPlantUml,
      proposedPlantUml,
      messageIndex,
      summary,
    });
  } catch (error) {
    console.error('Error proposing UML from chat:', error);
    return res.status(500).json({
      error: 'Failed to propose UML from chat',
    });
  }
};

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
    const {
      session,
      hasPersistentSession,
      currentPlantUml,
    } = await getCurrentPlantUmlForSession(sessionId);

    // If a sessionId was explicitly provided but no session exists, keep the old behaviour.
    if (!session && sessionId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const newPlantUml = await generateUmlFromChat({
      sessionId: sessionId || 'no-session',
      messages,
      currentPlantUml,
    });

    let savedPlantUml = newPlantUml;

    // Persist UML state if we have a real session
    if (hasPersistentSession && session) {
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

/**
 * POST /api/uml/from-chat/accept
 * Body: { sessionId, proposedPlantUml, messageIndex, summary }
 *
 * - Appends a UML revision for the session
 * - Updates current UML state
 * - Returns { plantuml, revisionIndex, canUndo, canRedo }
 */
export const acceptUmlFromChat = async (req, res) => {
  const { sessionId, proposedPlantUml, messageIndex, summary } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required to accept UML changes' });
  }

  if (!proposedPlantUml || typeof proposedPlantUml !== 'string') {
    return res.status(400).json({ error: 'proposedPlantUml is required' });
  }

  try {
    const session = await sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updated = await session.addUmlRevision({
      plantumlCode: proposedPlantUml,
      messageIndex,
      summary,
    });

    const latestUmlState = updated.getUmlState();

    return res.json({
      plantuml: latestUmlState.plantumlCode,
      revisionIndex: updated.currentUmlRevisionIndex,
      canUndo: updated.canUndoUml(),
      canRedo: updated.canRedoUml(),
    });
  } catch (error) {
    console.error('Error accepting UML from chat:', error);
    return res.status(500).json({
      error: 'Failed to accept UML from chat',
    });
  }
};

/**
 * POST /api/uml/from-chat/undo
 * Body: { sessionId }
 *
 * - Moves the current UML revision pointer one step back (if possible)
 * - Returns { plantuml, revisionIndex, canUndo, canRedo }
 */
export const undoUmlFromChat = async (req, res) => {
  const { sessionId } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required for UML undo' });
  }

  try {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updated = await session.undoUmlRevision();
    const latestUmlState = updated.getUmlState();

    return res.json({
      plantuml: latestUmlState.plantumlCode,
      revisionIndex: updated.currentUmlRevisionIndex,
      canUndo: updated.canUndoUml(),
      canRedo: updated.canRedoUml(),
    });
  } catch (error) {
    console.error('Error undoing UML from chat:', error);
    return res.status(500).json({
      error: 'Failed to undo UML from chat',
    });
  }
};

/**
 * POST /api/uml/from-chat/redo
 * Body: { sessionId }
 *
 * - Moves the current UML revision pointer one step forward (if possible)
 * - Returns { plantuml, revisionIndex, canUndo, canRedo }
 */
export const redoUmlFromChat = async (req, res) => {
  const { sessionId } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required for UML redo' });
  }

  try {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updated = await session.redoUmlRevision();
    const latestUmlState = updated.getUmlState();

    return res.json({
      plantuml: latestUmlState.plantumlCode,
      revisionIndex: updated.currentUmlRevisionIndex,
      canUndo: updated.canUndoUml(),
      canRedo: updated.canRedoUml(),
    });
  } catch (error) {
    console.error('Error redoing UML from chat:', error);
    return res.status(500).json({
      error: 'Failed to redo UML from chat',
    });
  }
};

