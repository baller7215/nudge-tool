import express from 'express';
import { generateFromChat } from '../controllers/umlFromChatController.js';

const router = express.Router();

// Generate or update UML from chat history
router.post('/uml/from-chat', generateFromChat);

export default router;

