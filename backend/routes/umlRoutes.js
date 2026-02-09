import express from 'express';
import {
  generateFromChat,
  proposeFromChat,
  acceptUmlFromChat,
  undoUmlFromChat,
  redoUmlFromChat,
} from '../controllers/umlFromChatController.js';

const router = express.Router();

// Propose UML changes from chat history (no persistence)
router.post('/uml/from-chat/propose', proposeFromChat);

// Accept proposed UML changes and create a revision checkpoint
router.post('/uml/from-chat/accept', acceptUmlFromChat);

// Undo/redo UML revisions for a session
router.post('/uml/from-chat/undo', undoUmlFromChat);
router.post('/uml/from-chat/redo', redoUmlFromChat);

// Generate or update UML from chat history (with persistence + SVG render)
router.post('/uml/from-chat', generateFromChat);

export default router;

