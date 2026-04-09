import { Session } from '../models/SessionModel.js';

class SessionService {
  // Create a new session
  async createSession(sessionData = {}) {
    try {
      const session = await Session.createSession(sessionData);
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Get session by ID
  async getSession(sessionId) {
    try {
      const session = await Session.findOne({ sessionId });
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  // Add a message to a session
  async addMessage(sessionId, messageData) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      const updatedSession = await session.addMessage(messageData);
      return updatedSession;
    } catch (error) {
      console.error('Error adding message to session:', error);
      throw error;
    }
  }

  // Update feedback for a specific message
  async updateFeedback(sessionId, messageIndex, feedbackType) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      const updatedSession = await session.updateFeedback(messageIndex, feedbackType);
      return updatedSession;
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  }

  // Add spin interaction
  async addSpinInteraction(sessionId, messageIndex, action) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      const updatedSession = await session.addSpinInteraction(messageIndex, action);
      return updatedSession;
    } catch (error) {
      console.error('Error adding spin interaction:', error);
      throw error;
    }
  }

  // Add card interaction
  async addCardInteraction(sessionId, cardData) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      const updatedSession = await session.addCardInteraction(cardData);
      return updatedSession;
    } catch (error) {
      console.error('Error adding card interaction:', error);
      throw error;
    }
  }

  // End a session
  async endSession(sessionId) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      const endedSession = await session.endSession();
      return endedSession;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  // Get session statistics
  async getSessionStats(sessionId) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      return {
        sessionId: session.sessionId,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        totalMessages: session.totalMessages,
        totalUserMessages: session.totalUserMessages,
        totalAssistantMessages: session.totalAssistantMessages,
        totalNudges: session.totalNudges,
        totalTokens: session.totalTokens,
        averageResponseTime: session.averageResponseTime,
        feedbackStats: session.feedbackStats,
        isActive: session.isActive
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  }

  // Get all sessions for a user (for future use)
  async getUserSessions(userId, limit = 10) {
    try {
      const sessions = await Session.find({ userId })
        .sort({ startTime: -1 })
        .limit(limit);
      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  // Get recent active sessions
  async getRecentSessions(limit = 10) {
    try {
      const sessions = await Session.find({ isActive: true })
        .sort({ startTime: -1 })
        .limit(limit);
      return sessions;
    } catch (error) {
      console.error('Error getting recent sessions:', error);
      throw error;
    }
  }

  // Clean up old inactive sessions (optional maintenance function)
  async cleanupOldSessions(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await Session.deleteMany({
        isActive: false,
        endTime: { $lt: cutoffDate }
      });
      
      console.log(`Cleaned up ${result.deletedCount} old sessions`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }

  // Add scratchpad snapshot
  async addScratchpadSnapshot(sessionId, text) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      const updatedSession = await session.addScratchpadSnapshot(text);
      return updatedSession;
    } catch (error) {
      console.error('Error adding scratchpad snapshot:', error);
      throw error;
    }
  }

  // Upsert nudge state in the active session
  async upsertNudgeState(sessionId, nudgeData) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      const updatedSession = await session.upsertNudgeState(nudgeData);
      return updatedSession;
    } catch (error) {
      console.error('Error upserting nudge state:', error);
      throw error;
    }
  }

  // Toggle nudge completion by display ID
  async toggleNudgeCompletion(sessionId, displayId) {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      const updatedSession = await session.toggleNudgeCompletion(displayId);
      return updatedSession;
    } catch (error) {
      console.error('Error toggling nudge completion:', error);
      throw error;
    }
  }
}

export default new SessionService(); 