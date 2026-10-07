import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';
import { connectMongo, inMemoryDb, getDbStatus } from './server/db.js';
import * as models from './server/models.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();



const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize MongoDB Connection (with graceful fallback)
connectMongo();

// Initialize GoogleGenAI client (Server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ==========================================
// REST API ROUTES BACKED BY MONGODB / DB
// ==========================================

// 1. Health & Database Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AcadLytic Backend (Express + Node)',
    database: getDbStatus(),
  });
});

// 2. Courses
app.get('/api/courses', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const courses = await models.Course.find();
      return res.json(courses);
    }
    return res.json(inMemoryDb.getCourses());
  } catch (err) {
    return res.json(inMemoryDb.getCourses());
  }
});

app.put('/api/courses/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const updates = req.body;
    const status = getDbStatus();
    if (status.connected) {
      const updated = await models.Course.findOneAndUpdate({ code }, updates, { new: true });
      return res.json(updated);
    }
    const updated = inMemoryDb.updateCourse(code, updates);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Assignments
app.get('/api/assignments', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const assignments = await models.Assignment.find();
      return res.json(assignments);
    }
    return res.json(inMemoryDb.getAssignments());
  } catch (err) {
    return res.json(inMemoryDb.getAssignments());
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const created = await models.Assignment.create(req.body);
      return res.status(201).json(created);
    }
    const created = inMemoryDb.addAssignment(req.body);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const status = getDbStatus();
    if (status.connected) {
      const updated = await models.Assignment.findOneAndUpdate({ id }, updates, { new: true });
      return res.json(updated);
    }
    const updated = inMemoryDb.updateAssignment(id, updates);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Lecture Events
app.get('/api/lectures', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const lectures = await models.LectureEvent.find();
      return res.json(lectures);
    }
    return res.json(inMemoryDb.getLectures());
  } catch (err) {
    return res.json(inMemoryDb.getLectures());
  }
});

app.post('/api/lectures', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const created = await models.LectureEvent.create(req.body);
      return res.status(201).json(created);
    }
    const created = inMemoryDb.addLecture(req.body);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const announcements = await models.Announcement.find();
      return res.json(announcements);
    }
    return res.json(inMemoryDb.getAnnouncements());
  } catch (err) {
    return res.json(inMemoryDb.getAnnouncements());
  }
});

// 6. Doubt Support Questions
app.get('/api/doubts', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const doubts = await models.DoubtQuestion.find();
      return res.json(doubts);
    }
    return res.json(inMemoryDb.getDoubts());
  } catch (err) {
    return res.json(inMemoryDb.getDoubts());
  }
});

app.post('/api/doubts', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const created = await models.DoubtQuestion.create(req.body);
      return res.status(201).json(created);
    }
    const created = inMemoryDb.addDoubt(req.body);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/doubts/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const reply = req.body;
    const status = getDbStatus();
    if (status.connected) {
      const updateObj = { $push: { replies: reply } };
      if (reply.isFacultyResponse) updateObj.$set = { status: 'Answered' };
      const updated = await models.DoubtQuestion.findOneAndUpdate({ id }, updateObj, { new: true });
      return res.json(updated);
    }
    const updated = inMemoryDb.addReply(id, reply);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Academic Performance & Semester Records
app.get('/api/performance', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const records = await models.SemesterRecord.find();
      return res.json(records);
    }
    return res.json(inMemoryDb.getPerformance());
  } catch (err) {
    return res.json(inMemoryDb.getPerformance());
  }
});

// 8. Custom Institutional Domain Record
app.get('/api/domain', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const domain = await models.DomainRecord.findOne();
      return res.json(domain || inMemoryDb.getDomain());
    }
    return res.json(inMemoryDb.getDomain());
  } catch (err) {
    return res.json(inMemoryDb.getDomain());
  }
});

app.put('/api/domain', async (req, res) => {
  try {
    const { domain } = req.body;
    const status = getDbStatus();
    if (status.connected) {
      const updated = await models.DomainRecord.findOneAndUpdate(
        {},
        { domain, status: 'active', sslActive: true, connectedAt: new Date().toISOString() },
        { new: true, upsert: true }
      );
      return res.json(updated);
    }
    const updated = inMemoryDb.updateDomain(domain);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 9. Users
app.get('/api/users', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.connected) {
      const users = await models.User.find();
      return res.json(users);
    }
    return res.json(inMemoryDb.getUsers());
  } catch (err) {
    return res.json(inMemoryDb.getUsers());
  }
});

// ==========================================
// GEMINI MULTI-TURN AI CHAT ENDPOINT
// ==========================================
// app.post('/api/chat', async (req, res) => {
//   try {
//     const {
//       message,
//       history = [],
//       model = 'gemini-3.5-flash',
//       role = 'academic_tutor',
//       useGoogleSearch = false,
//     } = req.body;

//     if (!message || typeof message !== 'string') {
//       return res.status(400).json({ error: 'Valid message string is required.' });
//     }

//     let systemInstruction =
//       'You are an authoritative academic tutor and curriculum mentor for computer science, engineering mathematics, and physics at Bharati Vidyapeeth College of Engineering (BVCOE), New Delhi. Provide academically precise, structured, and pedagogical explanations. Do not use emoji icons, em dashes, or generic conversational filler. Present mathematical expressions and code cleanly.';

//     if (role === 'pyq_analyst') {
//       systemInstruction =
//         'You are an academic examination and Previous Year Questions (PYQ) analyst for university semester exams. Evaluate question weightage, suggest step-by-step mark distribution, point out recurring examination theorems (e.g. Master Theorem, Fourier Series, Maxwell Equations, Dynamic Programming), and provide structured revision outlines. Avoid informal phrasing or emoji icons.';
//     } else if (role === 'lab_advisor') {
//       systemInstruction =
//         'You are a laboratory advisor and code debugging instructor for engineering coursework. Analyze code logic, pinpoint recursion errors or pointer misalignments, review experimental error calculations, and provide clean code corrections. Do not use emoji icons or em dashes.';
//     } else if (role === 'study_planner') {
//       systemInstruction =
//         'You are an expert academic strategist and cognitive workload optimizer for engineering students. You analyze pending assignment deadlines, course weightages, upcoming lecture syllabi, and study blocks to give practical, high-yield daily revision advice. Emphasize active recall, spaced repetition, Pomodoro pacing, and practical stress-reduction tactics. Avoid conversational filler or emoji icons.';
//     }

//     let selectedModel = 'gemini-3.5-flash';
//     if (model === 'gemini-3.1-pro-preview') {
//       selectedModel = 'gemini-3.1-pro-preview';
//     } else if (model === 'gemini-3.1-flash-lite') {
//       selectedModel = 'gemini-3.1-flash-lite';
//     } else {
//       selectedModel = 'gemini-3.5-flash';
//     }

//     const formattedContents = [];
//     if (Array.isArray(history)) {
//       for (const item of history) {
//         if (item.role === 'user' || item.role === 'model') {
//           formattedContents.push({
//             role: item.role,
//             parts: [{ text: String(item.text || '') }],
//           });
//         }
//       }
//     }

//     formattedContents.push({
//       role: 'user',
//       parts: [{ text: message }],
//     });

//     const tools = useGoogleSearch ? [{ googleSearch: {} }] : undefined;

//     const response = await ai.models.generateContent({
//       model: selectedModel,
//       contents: formattedContents,
//       config: {
//         systemInstruction,
//         tools,
//       },
//     });

//     const replyText = response.text || 'No response generated.';
//     const groundingChunks =
//       response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

//     const searchSources = groundingChunks
//       .map((chunk) => {
//         if (chunk.web) {
//           return {
//             title: chunk.web.title || 'Web Reference',
//             uri: chunk.web.uri || '',
//           };
//         }
//         return null;
//       })
//       .filter(Boolean);

//     return res.json({
//       text: replyText,
//       model: selectedModel,
//       sources: searchSources,
//     });
//   } catch (error) {
//     console.error('Gemini Chat API Error:', error);
//     return res.status(500).json({
//       error: error?.message || 'Failed to process AI chat request.',
//     });
//   }
// });

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await model.generateContent(message);
    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
});

// ==========================================
// WEBSOCKET FOR GEMINI LIVE VOICE API
// ==========================================
const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', async (clientWs) => {
  let session = null;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: {
          parts: [
            {
              text: 'You are an academic voice assistant for AcadLytic at Bharati Vidyapeeth College of Engineering. Help engineering students understand coursework, prepare for tests, plan study schedules, and clarify concepts verbally. Be concise, direct, and pedagogical. Do not use emoji icons or colloquial filler.',
            },
          ],
        },
      },
    });

    session.on('content', (serverContent) => {
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            type: 'content',
            content: serverContent,
          })
        );
      }
    });

    session.on('error', (err) => {
      console.error('Live API Session error:', err);
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            error: err?.message || 'Live session error occurred.',
          })
        );
      }
    });

    session.on('close', () => {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ type: 'closed' }));
      }
    });

    clientWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'audio_chunk' && msg.data) {
          await session.sendRealtimeInput([
            {
              mimeType: 'audio/pcm;rate=16000',
              data: msg.data,
            },
          ]);
        } else if (msg.type === 'text_input' && msg.text) {
          await session.sendRealtimeInput([
            {
              text: msg.text,
            },
          ]);
        }
      } catch (wsErr) {
        console.error('Error handling client websocket message:', wsErr);
      }
    });

    clientWs.on('close', () => {
      if (session) {
        try {
          session.close();
        } catch (_) { }
      }
    });
  } catch (err) {
    console.error('Failed to establish Live API connection:', err);
    if (clientWs.readyState === 1) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: 'Could not connect to Live Audio Service.',
        })
      );
      clientWs.close();
    }
  }
});

// ==========================================
// VITE CLIENT INTEGRATION
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(
      `[AcadLytic] Server running at http://localhost:${PORT}`
    );
  });
}

startServer();
