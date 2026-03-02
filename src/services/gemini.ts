import { useState, useCallback, useRef, useEffect } from 'react';

export function getBestFemaleVoice(): SpeechSynthesisVoice | null {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();

    // Priority order for natural-sounding female English voices
    const preferredNames = [
        'Google US English',
        'Samantha',
        'Microsoft Zira Desktop',
        'Microsoft Zira - English (United States)',
        'Karen',
        'Victoria',
        'Amira',
        'Tessa'
    ];

    for (const name of preferredNames) {
        const voice = voices.find(v => v.name === name);
        if (voice) return voice;
    }

    // Fallback to any en-US or English female-sounding voice
    const fallback = voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];
    return fallback || null;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    imageUrl?: string;
}

export function useLiveAgent() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextAudioTimeRef = useRef<number>(0);

    // Initialize the WebSocket connection
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // In local dev via Vite, this will hit Vite proxy which might not be configured for ws unless explicitly defined.
        // Assuming the backend is running directly on 8080 or mapped via Vite.
        const wsUrl = import.meta.env.DEV
            ? 'ws://localhost:8080/api/gemini/live'
            : `${protocol}//${window.location.host}/api/gemini/live`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("Connected to Live Agent");
            setIsConnected(true);
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);

                // Handle Server Content (model turns)
                if (response.serverContent?.modelTurn) {
                    const parts = response.serverContent.modelTurn.parts;
                    if (parts && parts.length > 0) {
                        const textContent = parts
                            .filter((p: any) => p.text)
                            .map((p: any) => p.text)
                            .join('');

                        if (textContent) {
                            setMessages(prev => {
                                // Simple buffering: append to the last message if it's from the model, or create new.
                                const lastMessage = prev[prev.length - 1];
                                if (lastMessage && lastMessage.role === 'model') {
                                    const updated = [...prev];
                                    const newText = lastMessage.text + textContent;
                                    updated[updated.length - 1] = { ...lastMessage, text: newText };

                                    // Speak the appended chunk immediately it arrives mapping word by word for low latency
                                    // Or for simplicity, buffer sentences to speak.
                                    // Let's just dispatch to speech synthesis here for newly parsed sentences, 
                                    // simple implementation: just speak the whole chunk as it comes in
                                    if ('speechSynthesis' in window) {
                                        const utterance = new SpeechSynthesisUtterance(textContent);
                                        const voice = getBestFemaleVoice();
                                        if (voice) utterance.voice = voice;
                                        utterance.rate = 1.05;
                                        window.speechSynthesis.speak(utterance);
                                    }
                                    return updated;
                                } else {
                                    if ('speechSynthesis' in window) {
                                        const utterance = new SpeechSynthesisUtterance(textContent);
                                        const voice = getBestFemaleVoice();
                                        if (voice) utterance.voice = voice;
                                        utterance.rate = 1.05;
                                        window.speechSynthesis.speak(utterance);
                                    }
                                    return [...prev, { role: 'model', text: textContent }];
                                }
                            });
                        }

                        // Handle raw audio playback from server if available
                        const audioParts = parts.filter((p: any) => p.inlineData?.mimeType.startsWith('audio/'));
                        if (audioParts.length > 0) {
                            if (!audioContextRef.current) {
                                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                            }

                            const ctx = audioContextRef.current;
                            if (ctx.state === 'suspended') {
                                ctx.resume();
                            }

                            for (const part of audioParts) {
                                const base64Data = part.inlineData.data;
                                const binaryString = window.atob(base64Data);
                                const len = binaryString.length;
                                const bytes = new Uint8Array(len);
                                for (let i = 0; i < len; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }

                                // Gemini Live Audio is 16-bit PCM at 24000Hz
                                const int16Array = new Int16Array(bytes.buffer);
                                const float32Array = new Float32Array(int16Array.length);
                                for (let i = 0; i < int16Array.length; i++) {
                                    float32Array[i] = int16Array[i] / 32768.0;
                                }

                                const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
                                audioBuffer.getChannelData(0).set(float32Array);

                                const source = ctx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(ctx.destination);

                                // Schedule playback sequentially
                                const currentTime = ctx.currentTime;
                                const playTime = Math.max(currentTime, nextAudioTimeRef.current);
                                source.start(playTime);
                                nextAudioTimeRef.current = playTime + audioBuffer.duration;
                            }
                        }
                    }
                }

                // Handle tool calls / rag responses if needed here
            } catch (err) {
                console.error("Error parsing message from Live Agent", err);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from Live Agent");
            setIsConnected(false);
        };

        ws.onerror = (e) => {
            console.error("WebSocket Error:", e);
            setError("Connection to Live Agent failed.");
        };

        wsRef.current = ws;
    }, []);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.error);
            audioContextRef.current = null;
            nextAudioTimeRef.current = 0;
        }
    }, []);

    const sendMessage = useCallback((text: string, imageBlob?: Blob) => {
        let ws: WebSocket | null = null;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            ws = wsRef.current;
        } else {
            console.warn("WebSocket not ready. Attempting to send anyway if it connects...");
            setError("Not connected to agent.");
            return;
        }

        // Add user message to UI immediately
        let imageUrl: string | undefined;
        if (imageBlob) imageUrl = URL.createObjectURL(imageBlob);
        setMessages(prev => [...prev, { role: 'user', text, imageUrl }]);

        if (imageBlob) {
            // Read blob to base64 and send as ClientContent turn
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64String = result.split(',')[1];

                ws?.send(JSON.stringify({
                    clientContent: {
                        turns: [{
                            role: 'user',
                            parts: [
                                { inlineData: { mimeType: imageBlob.type, data: base64String } },
                                { text: text || "Describe this image." }
                            ]
                        }],
                        turnComplete: true
                    }
                }));
            };
            reader.readAsDataURL(imageBlob);
        } else {
            // Text only
            ws.send(JSON.stringify({
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: text }]
                    }],
                    turnComplete: true
                }
            }));
        }
    }, []);

    const appendUserTranscription = useCallback((text: string) => {
        setMessages(prev => [...prev, { role: 'user', text }]);
    }, []);

    const sendRealtimeFrame = useCallback((base64String: string, mimeType: string = "image/jpeg") => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        wsRef.current.send(JSON.stringify({
            realtimeInput: {
                mediaChunks: [
                    { mimeType, data: base64String }
                ]
            }
        }));
    }, []);

    useEffect(() => {
        // Auto connect on mount
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        messages,
        isConnected,
        error,
        sendMessage,
        sendRealtimeFrame,
        appendUserTranscription
    };
}
