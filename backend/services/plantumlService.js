// services/plantumlService.js
import axios from 'axios';
import zlib from 'zlib';
import { promisify } from 'util';

// use deflateRaw for raw deflate (without zlib headers) as PlantUML expects
const deflateRaw = promisify(zlib.deflateRaw);

const PLANTUML_SERVER_URL = 'https://www.plantuml.com/plantuml';

/**
 * renders PlantUML code to SVG by proxying to the public PlantUML server
 * @param {string} plantumlCode - the PlantUML code to render
 * @returns {Promise<string>} - the SVG content as a string
 */
export const renderPlantUmlToSvg = async (plantumlCode) => {
  try {
    // encode the PlantUML code using the PlantUML encoding format
    // PlantUML uses deflate compression + base64
    const encoded = await encodePlantUml(plantumlCode);
    
    // request SVG format from PlantUML server
    // with proper PlantUML encoding, no prefix is needed
    const url = `${PLANTUML_SERVER_URL}/svg/${encoded}`;
    
    console.log('Requesting PlantUML URL:', url.substring(0, 100) + '...');
    
    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 30000, // 30 second timeout
    });

    const responseText = response.data;
    
    // check if response is valid SVG
    // PlantUML may include <?plantuml ...?> processing instruction before <svg>
    const trimmedResponse = responseText.trim();
    const hasSvgTag = trimmedResponse.includes('<svg');
    const isStandardXml = trimmedResponse.startsWith('<?xml');
    const isPlantUmlProcessingInstruction = trimmedResponse.startsWith('<?plantuml');
    
    // valid SVG responses can start with:
    // - <?xml (standard XML declaration)
    // - <?plantuml ...?><svg (PlantUML processing instruction + SVG)
    // - <svg (direct SVG tag)
    // as long as it contains <svg tag, it's valid SVG
    if (!hasSvgTag) {
      // this might be an error message or HTML
      console.error('PlantUML response does not look like SVG. Response preview:', responseText.substring(0, 200));
      
      // check if it's an HTML error page
      if (trimmedResponse.startsWith('<!DOCTYPE') || trimmedResponse.startsWith('<html')) {
        throw new Error('PlantUML server returned an HTML error page. Check encoding format.');
      }
      
      // check if it's a plain text error
      if (responseText.length < 500 && !responseText.includes('<')) {
        throw new Error(`PlantUML error: ${responseText}`);
      }
      
      throw new Error('Invalid response from PlantUML server - response is not valid SVG');
    }

    // check if the response contains PlantUML error messages
    // PlantUML errors are typically in SVG format with error text
    if (responseText.includes('The plugin you are using') || 
        responseText.includes('Syntax Error') ||
        (responseText.includes('Error') && responseText.includes('plugin'))) {
      // try to extract the actual error message
      const errorMatch = responseText.match(/<text[^>]*>([^<]+Error[^<]*)<\/text>/i);
      const errorMsg = errorMatch ? errorMatch[1].trim() : 'Invalid PlantUML syntax';
      throw new Error(errorMsg);
    }

    return responseText;
  } catch (error) {
    if (error.response) {
      // if we got a response but it's an error status
      if (error.response.status === 400 || error.response.status === 500) {
        const responseText = error.response.data || '';
        if (responseText.includes('Error') || responseText.includes('Syntax')) {
          throw new Error('Invalid PlantUML syntax');
        }
      }
      throw new Error(`PlantUML server error: ${error.response.status}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - PlantUML server took too long to respond');
    } else if (error.message.includes('Invalid response') || error.message.includes('Invalid PlantUML')) {
      // re-throw our custom errors
      throw error;
    } else {
      throw new Error(`Failed to render PlantUML: ${error.message}`);
    }
  }
};

/**
 * encodes PlantUML code using PlantUML's encoding format
 * PlantUML uses raw deflate compression followed by custom base64-like encoding
 * the custom encoding uses: 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_
 * standard base64 uses: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
 * @param {string} text - PlantUML code
 * @returns {Promise<string>} - encoded string
 */
const encodePlantUml = async (text) => {
  try {
    // convert text to buffer
    const textBuffer = Buffer.from(text, 'utf8');
    
    // use deflateRaw for raw deflate (without zlib headers) - this is what PlantUML expects
    const deflated = await deflateRaw(textBuffer);
    
    // get standard base64 encoding
    const standardBase64 = deflated.toString('base64');
    
    // PlantUML character set: 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_
    // Standard base64: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
    // Mapping: reorder digits to front, and replace + with -, / with _
    const standardChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const plantumlChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
    
    // convert each character from standard base64 to PlantUML encoding
    let encoded = '';
    for (let i = 0; i < standardBase64.length; i++) {
      const char = standardBase64[i];
      if (char === '=') {
        // skip padding characters
        break;
      }
      const index = standardChars.indexOf(char);
      if (index !== -1) {
        encoded += plantumlChars[index];
      } else {
        encoded += char;
      }
    }
    
    return encoded;
  } catch (error) {
    throw new Error(`Failed to encode PlantUML code: ${error.message}`);
  }
};
