// controllers/plantumlController.js
import { renderPlantUmlToSvg } from '../services/plantumlService.js';

export const renderPlantUml = async (req, res) => {
  const { plantuml } = req.body;

  if (!plantuml || typeof plantuml !== 'string') {
    return res.status(400).json({ error: 'PlantUML code is required' });
  }

  // basic size limit check (100KB)
  if (plantuml.length > 100000) {
    return res.status(400).json({ error: 'PlantUML code is too large (max 100KB)' });
  }

  try {
    const svgBlob = await renderPlantUmlToSvg(plantuml);
    
    // set appropriate headers for SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    
    // send the SVG
    res.send(svgBlob);
  } catch (error) {
    console.error('Error rendering PlantUML:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to render PlantUML diagram' 
    });
  }
};
