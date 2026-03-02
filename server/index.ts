import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const __dirname = path.resolve();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Setup explicit HTTP server to bind WebSockets to
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Removed local Vector DB load for external RAG

// Fallback REST AI client (optional, uses standard API Key if available)
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiRest: GoogleGenAI | null = null;
if (geminiApiKey) {
    aiRest = new GoogleGenAI({ apiKey: geminiApiKey });
}

// Vertex AI client specifically for Live API with RAG (ADC authenticated in Cloud Run)
const aiVertex = new GoogleGenAI({
    vertexai: true,
    project: 'thoughtinvest-prod',
    location: 'us-central1'
});

// Proxy endpoint for Gemini Chat (REST fallback)
app.post('/api/gemini/chat', async (req, res) => {
    if (!aiRest) return res.status(500).json({ error: 'REST API not configured.' });
    try {
        const { history, newMessage, imageBase64, mimeType, knowledgeBase } = req.body;
        // ... (truncated REST logic for brevity if needed, but keeping full)
        const contents = history.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const currentMessageParts: any[] = [];
        if (imageBase64 && mimeType) {
            currentMessageParts.push({ inlineData: { data: imageBase64, mimeType } });
        }
        currentMessageParts.push({ text: newMessage });
        contents.push({ role: 'user', parts: currentMessageParts });

        const response = await aiRest.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents,
            config: { systemInstruction: knowledgeBase }
        });
        res.json({ text: response.text || "No response generated." });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Setup WebSocket routing
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/api/gemini/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Handle WebSocket connections
wss.on('connection', async (ws: WebSocket) => {
    console.log('Client connected to /api/gemini/live WebSocket');

    try {
        let sessionClosed = false;

        // Connect to Vertex AI Multimodal Live API
        const session = await aiVertex.live.connect({
            model: "gemini-2.0-flash-live-preview-04-09",
            config: {
                systemInstruction: {
                    parts: [{ text: "You are the ProCyte One analyzer assistant. You answer questions strictly based on the provided manual context." }]
                },
                responseModalities: [Modality.TEXT],
                tools: [
                    {
                        retrieval: {
                            vertexRagStore: {
                                ragResources: [
                                    {
                                        ragCorpus: "projects/thoughtinvest-prod/locations/us-south1/ragCorpora/2305843009213693952"
                                    }
                                ]
                            }
                        }
                    }
                ]
            },
            callbacks: {
                onmessage: (serverMessage) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(serverMessage));
                    }
                },
                onerror: (e) => {
                    console.error("Vertex AI Live Error Event Details:", JSON.stringify(e, null, 2), e);
                },
                onclose: (event) => {
                    console.error("Vertex AI Live closed connection. Details:", JSON.stringify(event, null, 2), event);
                    sessionClosed = true;
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close(1000, 'Vertex AI closed connection');
                    }
                }
            }
        });

        console.log('Connected to Vertex AI Multimodal Live endpoint');

        // Relay messages from Browser to Vertex AI
        ws.on('message', async (data) => {
            if (sessionClosed) return;
            const messageStr = data.toString();
            try {
                const payload = JSON.parse(messageStr);

                if (payload.clientContent) {
                    const turns = payload.clientContent.turns || [];
                    const lastTurn = turns[turns.length - 1];
                    let userText = '';

                    if (lastTurn && lastTurn.role === 'user') {
                        const textParts = lastTurn.parts.filter((p: any) => p.text);
                        if (textParts.length > 0) {
                            userText = textParts.map((p: any) => p.text).join(' ');
                        }
                    }

                    // Note: External RAG logic removed.
                    // The SDK handles Google Cloud Vertex AI RAG automatically via the tools configuration above.

                    if (payload.clientContent && payload.clientContent.turns) {
                        session.sendClientContent(payload.clientContent);
                    } else if (payload.realtimeInput && payload.realtimeInput.mediaChunks) {
                        for (const chunk of payload.realtimeInput.mediaChunks) {
                            if (chunk.mimeType?.startsWith('audio/')) {
                                session.sendRealtimeInput({ audio: { mimeType: chunk.mimeType, data: chunk.data } });
                            } else {
                                session.sendRealtimeInput({ media: { mimeType: chunk.mimeType, data: chunk.data } });
                            }
                        }
                    } else if (payload.toolResponse) {
                        session.sendToolResponse(payload.toolResponse);
                    } else {
                        console.warn("Unrecognized message type from browser client:", Object.keys(payload));
                        // Fallback completely to raw socket sending to avoid silent failure if SDK changes
                        if ((session as any).conn) {
                            (session as any).conn.send(JSON.stringify(payload));
                        }
                    }
                } else if (payload.realtimeInput) {
                    if (payload.realtimeInput.mediaChunks) {
                        for (const chunk of payload.realtimeInput.mediaChunks) {
                            if (chunk.mimeType?.startsWith('audio/')) {
                                session.sendRealtimeInput({ audio: { mimeType: chunk.mimeType, data: chunk.data } });
                            } else {
                                session.sendRealtimeInput({ media: { mimeType: chunk.mimeType, data: chunk.data } });
                            }
                        }
                    }
                } else if (payload.toolResponse) {
                    session.sendToolResponse(payload.toolResponse);
                } else {
                    console.warn("Unrecognized message type from browser client:", Object.keys(payload));
                }
            } catch (err) {
                console.error("Error routing message to Vertex:", err);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected. Closing Vertex session...');
            sessionClosed = true;
            try { session.close(); } catch (e) { }
        });

    } catch (err) {
        console.error('Failed to initialize Vertex AI Live session:', err);
        ws.close(1011, 'Failed to connect to Vertex AI');
    }
});

// Serve frontend static files
app.use(express.static(path.join(process.cwd(), 'dist')));
app.use((req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist/index.html'));
});

server.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server is running securely on port ${port} with WebSockets enabled`);
});
