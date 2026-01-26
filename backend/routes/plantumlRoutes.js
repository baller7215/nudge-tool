// backend/routes/plantumlRoutes.js
import express from 'express';
import { renderPlantUml } from '../controllers/plantumlController.js';

const router = express.Router();

router.post('/render', renderPlantUml);

export default router;