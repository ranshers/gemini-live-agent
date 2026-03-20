import { useState, useRef, useEffect, useCallback } from 'react';
import { Activity, Volume2, VolumeX, SignalHigh, WifiOff, Mic, MicOff } from 'lucide-react';
import CameraFeed, { type CameraFeedRef } from './components/CameraFeed';
import ChatInterface from './components/ChatInterface';
import { useLiveAgent } from './services/gemini';
import { useAudioStreamer } from './services/audioStreamer';
import './App.css';

function App() {
  const [isMuted, setIsMuted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const cameraRef = useRef<CameraFeedRef>(null);

  // Initialize WebSockets via Custom Hook
  const { messages, isConnected, isAgentThinking, isAgentSpeaking, error, sendRealtimeFrame, appendUserTranscription, interruptAgent, commitAudioTurn } = useLiveAgent();

  const handleAudioChunk = useCallback((base64String: string) => {
    if (isConnected) {
      sendRealtimeFrame(base64String, 'audio/pcm;rate=16000');
    }
  }, [isConnected, sendRealtimeFrame]);

  const handleTranscription = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      appendUserTranscription(text);
      setInterimTranscript('');
      // `commitAudioTurn` is now handled by the volume-based VAD directly for faster response.
    } else {
      setInterimTranscript(text);
    }
  }, [appendUserTranscription, commitAudioTurn]);

  // Audio Streaming Hook
  const { isRecording, startRecording, stopRecording } = useAudioStreamer(handleAudioChunk, handleTranscription, () => {
    commitAudioTurn();
    stopRecording();
  });

  // Initialize voices (for native TTS fallback)
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Frame streaming loop: Captures and sends a frame periodically if connected
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isConnected) {
      interval = setInterval(async () => {
        if (cameraRef.current) {
          const blob = await cameraRef.current.captureImage();
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64String = result.split(',')[1];
              sendRealtimeFrame(base64String, blob.type);
            };
            reader.readAsDataURL(blob);
          }
        }
      }, 5000); // Send a frame every 5 seconds (adjust to ~2fps or 1fps for actual live streaming if backend is configured to accept it without rate limit, here cautious at 1 per 5s)
    }
    return () => clearInterval(interval);
  }, [isConnected, sendRealtimeFrame]);

  const toggleMicrophone = () => {
    if (isRecording) {
      commitAudioTurn();
      stopRecording();
    } else {
      interruptAgent();
      startRecording();
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="brand">
          <Activity className="brand-icon" size={24} strokeWidth={2.5} />
          <h1>ProCyte One Assistant</h1>
          <div className="connection-status" title={error || (isConnected ? 'Connected' : 'Disconnected')}>
            {isConnected ? <SignalHigh size={18} color="#4ade80" /> : <WifiOff size={18} color="#ef4444" />}
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`settings-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleMicrophone}
            title={isRecording ? "Stop Microphone" : "Start Microphone"}
            style={isRecording ? { color: '#ef4444', borderColor: '#ef4444' } : {}}
          >
            {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button className="settings-btn" onClick={() => setIsMuted(!isMuted)} title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="camera-section">
          <CameraFeed ref={cameraRef} />
        </section>

        <section className="chat-section">
          <ChatInterface
            messages={messages}
            isLoading={isAgentThinking}
            isConnected={isConnected}
            isRecording={isRecording}
            isAgentSpeaking={isAgentSpeaking}
            onToggleMicrophone={toggleMicrophone}
            interimTranscript={interimTranscript}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
