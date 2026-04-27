import { loadEnvFile } from 'node:process';
try { loadEnvFile(); } catch {}
import { GoogleGenAI } from '@google/genai';

const useVertex = process.env.VERTEX === 'true';
const ai = useVertex
  ? new GoogleGenAI({ vertexai: true, apiKey: process.env.VERTEX_API_KEY || '' })
  : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function run() {
  console.log('Generating image...');
  const result = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'A tiny blue cat',
    config: {
      numberOfImages: 1,
      aspectRatio: '16:9',
      outputMimeType: 'image/jpeg'
    }
  });
  console.log('Image bytes length:', result.generatedImages[0].image.imageBytes.length);
}
run().catch(console.error);
