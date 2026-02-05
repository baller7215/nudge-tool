import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isNudge: { type: Boolean, default: false },
  nudgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nudge' },
  feedback: { type: String, enum: ['positive', 'negative', null], default: null },
  responseTime: { type: Number }, // in milliseconds
  tokensUsed: { type: Number, default: 0 },
  model: { type: String, default: 'gpt-3.5-turbo' }
});

const spinInteractionSchema = new mongoose.Schema({
  messageIndex: { type: Number, required: true },
  messageContent: { type: String, required: true },
  isNudge: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  action: { type: String, enum: ['regenerate', 'new_nudge'], required: true }
});

const cardInteractionSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  cardTitle: { type: String, required: true },
  cardContent: { type: String, required: true },
  action: { type: String, enum: ['like', 'dislike', 'neutral'], required: true },
  timestamp: { type: Date, default: Date.now },
  nudgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nudge' }
});

const scratchpadSnapshotSchema = new mongoose.Schema({
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const umlStateSchema = new mongoose.Schema({
  umlType: { type: String, enum: ['class', 'sequence', 'other'], default: 'class' },
  plantumlCode: { type: String },
  lastUpdatedAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String }, // Optional - for future user authentication
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  messages: [messageSchema],
  spinInteractions: [spinInteractionSchema],
  cardInteractions: [cardInteractionSchema],
  totalMessages: { type: Number, default: 0 },
  totalUserMessages: { type: Number, default: 0 },
  totalAssistantMessages: { type: Number, default: 0 },
  totalNudges: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  totalSpinInteractions: { type: Number, default: 0 },
  totalCardInteractions: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 },
  feedbackStats: {
    positive: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  spinStats: {
    regenerations: { type: Number, default: 0 },
    newNudges: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  cardStats: {
    liked: { type: Number, default: 0 },
    disliked: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  metadata: {
    userAgent: { type: String },
    ipAddress: { type: String },
    deviceType: { type: String }
  },
  scratchpadSnapshots: [scratchpadSnapshotSchema],
  umlState: umlStateSchema
}, {
  timestamps: true
});

// Index for efficient querying
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ startTime: -1 });
sessionSchema.index({ isActive: 1 });

// Virtual for session duration
sessionSchema.virtual('duration').get(function() {
  const end = this.endTime || new Date();
  return end - this.startTime;
});

// Method to add a message to the session
sessionSchema.methods.addMessage = function(messageData) {
  this.messages.push(messageData);
  this.totalMessages = this.messages.length;
  this.totalUserMessages = this.messages.filter(m => m.role === 'user').length;
  this.totalAssistantMessages = this.messages.filter(m => m.role === 'assistant').length;
  this.totalNudges = this.messages.filter(m => m.isNudge).length;
  this.totalTokens = this.messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
  
  // Calculate average response time
  const assistantMessages = this.messages.filter(m => m.role === 'assistant' && m.responseTime);
  if (assistantMessages.length > 0) {
    this.averageResponseTime = assistantMessages.reduce((sum, m) => sum + m.responseTime, 0) / assistantMessages.length;
  }
  
  return this.save();
};

// Method to update feedback
sessionSchema.methods.updateFeedback = function(messageIndex, feedbackType) {
  if (this.messages[messageIndex]) {
    this.messages[messageIndex].feedback = feedbackType;
    
    // Update feedback stats
    this.feedbackStats.total = this.messages.filter(m => m.feedback).length;
    this.feedbackStats.positive = this.messages.filter(m => m.feedback === 'positive').length;
    this.feedbackStats.negative = this.messages.filter(m => m.feedback === 'negative').length;
    
    return this.save();
  }
  throw new Error('Message index not found');
};

// Method to add spin interaction
sessionSchema.methods.addSpinInteraction = function(messageIndex, action) {
  if (this.messages[messageIndex]) {
    const message = this.messages[messageIndex];
    const spinInteraction = {
      messageIndex,
      messageContent: message.content,
      isNudge: message.isNudge || false,
      timestamp: new Date(),
      action
    };
    
    this.spinInteractions.push(spinInteraction);
    this.totalSpinInteractions = this.spinInteractions.length;
    
    // Update spin stats
    this.spinStats.total = this.spinInteractions.length;
    this.spinStats.regenerations = this.spinInteractions.filter(s => s.action === 'regenerate').length;
    this.spinStats.newNudges = this.spinInteractions.filter(s => s.action === 'new_nudge').length;
    
    return this.save();
  }
  throw new Error('Message index not found');
};

// Method to add card interaction
sessionSchema.methods.addCardInteraction = function(cardData) {
  const cardInteraction = {
    cardId: cardData.cardId,
    cardTitle: cardData.cardTitle,
    cardContent: cardData.cardContent,
    action: cardData.action,
    timestamp: new Date(),
    nudgeId: cardData.nudgeId
  };
  
  this.cardInteractions.push(cardInteraction);
  this.totalCardInteractions = this.cardInteractions.length;
  
  // Update card stats
  this.cardStats.total = this.cardInteractions.length;
  this.cardStats.liked = this.cardInteractions.filter(c => c.action === 'like').length;
  this.cardStats.disliked = this.cardInteractions.filter(c => c.action === 'dislike').length;
  this.cardStats.neutral = this.cardInteractions.filter(c => c.action === 'neutral').length;
  
  return this.save();
};

// Method to end session
sessionSchema.methods.endSession = function() {
  this.endTime = new Date();
  this.isActive = false;
  return this.save();
};

// Method to add a scratchpad snapshot
sessionSchema.methods.addScratchpadSnapshot = function(text) {
  // Only add if different from last snapshot
  if (
    this.scratchpadSnapshots.length === 0 ||
    this.scratchpadSnapshots[this.scratchpadSnapshots.length - 1].text !== text
  ) {
    this.scratchpadSnapshots.push({ text, timestamp: new Date() });
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to create a new session
sessionSchema.statics.createSession = function(sessionData = {}) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return this.create({
    sessionId,
    ...sessionData
  });
};

// method to upsert UML state for the session
sessionSchema.methods.setUmlState = function(umlData) {
  this.umlState = {
    ...(this.umlState ? this.umlState.toObject() : {}),
    ...umlData,
    lastUpdatedAt: new Date()
  };
  return this.save();
};

// method to get UML state with sensible defaults
sessionSchema.methods.getUmlState = function() {
  if (!this.umlState || !this.umlState.plantumlCode) {
    return {
      umlType: 'class',
      plantumlCode: '@startuml\n@enduml',
      lastUpdatedAt: this.umlState?.lastUpdatedAt || this.startTime || new Date()
    };
  }
  return this.umlState;
};

export const Session = mongoose.model('Session', sessionSchema); 