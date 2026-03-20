import { useState, useRef, useCallback, useEffect } from 'react';

// The AudioContext PCM downsampling utility for Google Live API
// Converts Float32Array to Int16Array (16-bit PCM buffer)
function processAudioData(buffer: Float32Array): Uint8Array {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
        let s = Math.max(-1, Math.min(1, buffer[l]));
        buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return new Uint8Array(buf.buffer);
}

// Converts a Uint8Array to a Base64 string chunk
function bufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function useAudioStreamer(
    onAudioChunk: (base64Data: string) => void,
    onTranscription?: (text: string, isFinal: boolean) => void,
    onVADEnd?: () => void
) {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const recognitionRef = useRef<any>(null);
    const isRecordingRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const silentChunksRef = useRef(0);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Vertex Live requires 16000 Hz sample rate
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const context = new AudioContextClass({ sampleRate: 16000 });
            audioContextRef.current = context;

            const source = context.createMediaStreamSource(stream);
            const processor = context.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const float32Array = e.inputBuffer.getChannelData(0);

                // --- VAD (Voice Activity Detection) ---
                let sumSquare = 0;
                for (let i = 0; i < float32Array.length; i++) {
                    sumSquare += float32Array[i] * float32Array[i];
                }
                const rms = Math.sqrt(sumSquare / float32Array.length);

                if (rms > 0.015) { // Threshold for speaking
                    isSpeakingRef.current = true;
                    silentChunksRef.current = 0;
                } else if (isSpeakingRef.current) {
                    silentChunksRef.current++;
                    if (silentChunksRef.current >= 3) { // 3 chunks of 256ms = ~768ms silence
                        isSpeakingRef.current = false;
                        silentChunksRef.current = 0;
                        if (onVADEnd) onVADEnd();
                    }
                }
                // --- End VAD ---

                const pcm16Buffer = processAudioData(float32Array);
                const base64Chunk = bufferToBase64(pcm16Buffer);
                onAudioChunk(base64Chunk);
            };

            source.connect(processor);
            processor.connect(context.destination);

            // Speech Recognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition && onTranscription) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    let interimTranscript = '';
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript;
                        } else {
                            interimTranscript += transcript;
                        }
                    }
                    if (finalTranscript) {
                        onTranscription(finalTranscript, true);
                    }
                    if (interimTranscript) {
                        onTranscription(interimTranscript, false);
                    }
                };

                recognition.onerror = (e: any) => {
                    console.log('Speech recognition error:', e.error);
                };
                recognition.onend = () => {
                    console.log('Speech recognition ended. isRecording:', isRecordingRef.current);
                    if (isRecordingRef.current && recognitionRef.current) {
                        setTimeout(() => {
                            if (isRecordingRef.current && recognitionRef.current) {
                                try {
                                    recognitionRef.current.start();
                                } catch (err) {
                                    console.error("Failed to restart speech recognition after timeout", err);
                                }
                            }
                        }, 200);
                    }
                };

                try {
                    recognition.start();
                    console.log('Speech recognition started successfully.');
                } catch (e) {
                    console.error('Failed to start speech recognition initially', e);
                }
                recognitionRef.current = recognition;
            }

            setIsRecording(true);
            isRecordingRef.current = true;
        } catch (err) {
            console.error("Failed to start audio recording:", err);
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    }, [onAudioChunk, onTranscription, onVADEnd]);

    const stopRecording = useCallback(() => {
        isRecordingRef.current = false;

        if (processorRef.current && audioContextRef.current) {
            processorRef.current.disconnect();
            if (streamRef.current) {
                const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
                source.disconnect();
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore errors
            }
            recognitionRef.current = null;
        }

        setIsRecording(false);
        audioContextRef.current = null;
        streamRef.current = null;
        processorRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            // Cleanup if unmounted while recording
            stopRecording();
        }
    }, [stopRecording]);

    return {
        isRecording,
        startRecording,
        stopRecording
    };
}
