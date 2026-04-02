import express from 'express';
import sessionService from '../services/sessionService.js';

const router = express.Router();

// Create a new session
router.post('/create', async (req, res) => {
  try {
    const { userId, metadata } = req.body;
    const session = await sessionService.createSession({ userId, metadata });
    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
      error: error.message
    });
  }
});

// Get session by ID
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session',
      error: error.message
    });
  }
});

// Get session statistics
router.get('/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await sessionService.getSessionStats(sessionId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session stats',
      error: error.message
    });
  }
});

// Add message to session
router.post('/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messageData = req.body;
    
    const updatedSession = await sessionService.addMessage(sessionId, messageData);
    
    res.json({
      success: true,
      message: 'Message added to session',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error adding message to session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add message to session',
      error: error.message
    });
  }
});

// Update feedback for a message
router.post('/:sessionId/feedback/:messageIndex', async (req, res) => {
  try {
    const { sessionId, messageIndex } = req.params;
    const { feedbackType } = req.body;
    
    if (!['positive', 'negative'].includes(feedbackType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback type. Must be "positive" or "negative"'
      });
    }
    
    const updatedSession = await sessionService.updateFeedback(sessionId, parseInt(messageIndex), feedbackType);
    
    res.json({
      success: true,
      message: 'Feedback updated successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback',
      error: error.message
    });
  }
});

// Add spin interaction
router.post('/:sessionId/spin/:messageIndex', async (req, res) => {
  try {
    const { sessionId, messageIndex } = req.params;
    const { action } = req.body;
    
    if (!['regenerate', 'new_nudge'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "regenerate" or "new_nudge"'
      });
    }
    
    const updatedSession = await sessionService.addSpinInteraction(sessionId, parseInt(messageIndex), action);
    
    res.json({
      success: true,
      message: 'Spin interaction tracked successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error tracking spin interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track spin interaction',
      error: error.message
    });
  }
});

// Add card interaction
router.post('/:sessionId/card', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cardId, cardTitle, cardContent, action, nudgeId } = req.body;
    
    if (!['like', 'dislike', 'neutral'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "like", "dislike", or "neutral"'
      });
    }
    
    const cardData = {
      cardId,
      cardTitle,
      cardContent,
      action,
      nudgeId
    };
    
    const updatedSession = await sessionService.addCardInteraction(sessionId, cardData);
    
    res.json({
      success: true,
      message: 'Card interaction tracked successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error tracking card interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track card interaction',
      error: error.message
    });
  }
});

// End session
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const endedSession = await sessionService.endSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session ended successfully',
      session: endedSession
    });
  } catch (error) {
    const isNotFound = String(error?.message || '').includes('Session not found');
    if (isNotFound) {
      console.warn(`Session end requested but not found: ${req.params.sessionId}`);
    } else {
      console.error('Error ending session:', error);
    }
    res.status(isNotFound ? 404 : 500).json({
      success: false,
      message: isNotFound ? 'Session not found' : 'Failed to end session',
      error: isNotFound ? undefined : error.message
    });
  }
});

// Get recent active sessions
router.get('/recent/active', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const sessions = await sessionService.getRecentSessions(parseInt(limit));
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error getting recent sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent sessions',
      error: error.message
    });
  }
});

// Get user sessions (for future use)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    const sessions = await sessionService.getUserSessions(userId, parseInt(limit));
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user sessions',
      error: error.message
    });
  }
});

// Add scratchpad snapshot
router.post('/:sessionId/scratchpad-snapshot', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;
    if (typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const updatedSession = await sessionService.addScratchpadSnapshot(sessionId, text);
    res.json({ success: true, message: 'Scratchpad snapshot added', session: updatedSession });
  } catch (error) {
    console.error('Error adding scratchpad snapshot:', error);
    res.status(500).json({ success: false, message: 'Failed to add scratchpad snapshot', error: error.message });
  }
});

export default router; 