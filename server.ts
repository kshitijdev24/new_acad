import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Telemetry-enabled GoogleGenAI client (Server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// 1. Multi-turn Chat API with Model Selection, System Instruction, and Google Search Grounding
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      message,
      history = [],
      model = 'gemini-3.5-flash',
      role = 'academic_tutor',
      useGoogleSearch = false,
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message string is required.' });
    }

    // Role-specific system instructions
    let systemInstruction =
      'You are an authoritative academic tutor and curriculum mentor for computer science, engineering mathematics, and physics at Bharati Vidyapeeth College of Engineering (BVCOE), New Delhi. Provide academically precise, structured, and pedagogical explanations. Do not use emoji icons, em dashes, or generic conversational filler. Present mathematical expressions and code cleanly.';

    if (role === 'pyq_analyst') {
      systemInstruction =
        'You are an academic examination and Previous Year Questions (PYQ) analyst for university semester exams. Evaluate question weightage, suggest step-by-step mark distribution, point out recurring examination theorems (e.g. Master Theorem, Fourier Series, Maxwell Equations, Dynamic Programming), and provide structured revision outlines. Avoid informal phrasing or emoji icons.';
    } else if (role === 'lab_advisor') {
      systemInstruction =
        'You are a laboratory advisor and code debugging instructor for engineering coursework. Analyze code logic, pinpoint recursion errors or pointer misalignments, review experimental error calculations, and provide clean code corrections. Do not use emoji icons or em dashes.';
    } else if (role === 'study_planner') {
      systemInstruction =
        'You are an expert academic strategist and cognitive workload optimizer for engineering students. You analyze pending assignment deadlines, course weightages, upcoming lecture syllabi, and study blocks to give practical, high-yield daily revision advice. Emphasize active recall, spaced repetition, Pomodoro pacing, and practical stress-reduction tactics. Avoid conversational filler or emoji icons.';
    }

    // Map allowed models strictly per guidelines
    let selectedModel = 'gemini-3.5-flash';
    if (model === 'gemini-3.1-pro-preview') {
      selectedModel = 'gemini-3.1-pro-preview';
    } else if (model === 'gemini-3.1-flash-lite') {
      selectedModel = 'gemini-3.1-flash-lite';
    } else {
      selectedModel = 'gemini-3.5-flash';
    }

    // Format history for @google/genai
    const formattedContents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = [];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.role === 'user' || item.role === 'model') {
          formattedContents.push({
            role: item.role,
            parts: [{ text: String(item.text || '') }],
          });
        }
      }
    }

    // Add current user prompt
    formattedContents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Configure tools: Google Search Grounding with gemini-3.5-flash
    const tools = useGoogleSearch ? [{ googleSearch: {} }] : undefined;

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: formattedContents,
      config: {
        systemInstruction,
        tools,
      },
    });

    const replyText = response.text || 'No response generated.';

    // Extract grounding search metadata
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const searchSources = groundingChunks
      .map((chunk: any) => {
        if (chunk.web) {
          return {
            title: chunk.web.title || 'Web Reference',
            uri: chunk.web.uri || '',
          };
        }
        return null;
      })
      .filter(Boolean);

    return res.json({
      text: replyText,
      model: selectedModel,
      sources: searchSources,
    });
  } catch (error: any) {
    console.error('Gemini Chat API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to process AI chat request.',
    });
  }
});

// 2. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AcadLytic Backend' });
});

// 3. WebSocket server for Live Voice API (model: gemini-3.8-live)
const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  let session: any = null;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction:
          'You are the AcadLytic real-time voice academic assistant for Bharati Vidyapeeth College of Engineering students. Provide concise, direct, and factual technical answers for engineering courses. Do not use conversational filler or emoji icons.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio =
            message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'audio', audio }));
          }
          if (
            message.serverContent?.interrupted &&
            clientWs.readyState === WebSocket.OPEN
          ) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
          }
        },
      },
    });

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'connected' }));
    }

    clientWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio && session) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (err) {
        console.error('Live API message parsing error:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close?.();
      } catch (e) {}
    });
  } catch (err: any) {
    console.error('Failed to establish Live API session:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: err?.message || 'Failed to establish Gemini Live voice session.',
        })
      );
    }
  }
});

// 4. Vite middleware for dev or Static Files for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AcadLytic server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
