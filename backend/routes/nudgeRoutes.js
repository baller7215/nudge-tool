import express from 'express';
import { getRandomNudge, getSmartNudgeRecommendation, updateFeedback } from '../controllers/nudgeController.js';

const router = express.Router();

router.get('/random', getRandomNudge);
router.post('/smart', getSmartNudgeRecommendation);
router.post('/:nudgeId/feedback', updateFeedback);

export default router; 