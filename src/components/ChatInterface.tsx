import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Bot, User, Maximize, Volume2, Square, Mic } from 'lucide-react';
import { type ChatMessage, getBestFemaleVoice } from '../services/gemini';
import './ChatInterface.css';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    isLoading: boolean;
    isConnected: boolean;
    isRecording: boolean;
    isAgentSpeaking?: boolean;
    onToggleMicrophone: () => void;
    interimTranscript?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, isConnected, isRecording, isAgentSpeaking, onToggleMicrophone, interimTranscript }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSpeak = (text: string) => {
        if ('speechSynthesis' in window) {
            if (isSpeaking) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                return;
            }
            const utterance = new SpeechSynthesisUtterance(text);
            const voice = getBestFemaleVoice();
            if (voice) {
                utterance.voice = voice;
            }
            utterance.rate = 1.05;
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            setIsSpeaking(true);
            window.speechSynthesis.speak(utterance);
        }
    };

    return (
        <div className="chat-container premium-card">
            <div className="chat-header">
                <div className="header-title">
                    <Bot className="icon-bot" size={24} />
                    <div>
                        <h2>ProCyte Assistant</h2>
                        <p className="status-text">Powered by Gemini AI</p>
                    </div>
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="empty-state fade-in">
                        <div className="empty-icon-wrapper">
                            <Maximize size={48} className="empty-icon" />
                        </div>
                        <h3>How can I help you today?</h3>
                        <p>Show me the ProCyte One analyzer screen or a sample tube, and ask me a question.</p>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div key={index} className={`message-wrapper ${msg.role} fade-in`}>
                            <div className="avatar">
                                {msg.role === 'model' ? <Bot size={18} /> : <User size={18} />}
                            </div>
                            <div className="message-content">
                                {msg.imageUrl && (
                                    <div className="message-image">
                                        <img src={msg.imageUrl} alt="Captured frame" />
                                    </div>
                                )}
                                <div className="text-bubble">
                                    {msg.text.split('\n').map((line, i) => (
                                        <span key={i}>
                                            {line}
                                            <br />
                                        </span>
                                    ))}
                                    {msg.role === 'model' && (
                                        <button
                                            type="button"
                                            className="speak-button"
                                            onClick={() => handleSpeak(msg.text)}
                                            title={isSpeaking ? "Stop speaking" : "Speak response"}
                                        >
                                            {isSpeaking ? <Square size={14} /> : <Volume2 size={14} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {interimTranscript && (
                    <div className="message-wrapper user fade-in">
                        <div className="avatar">
                            <User size={18} />
                        </div>
                        <div className="message-content">
                            <div className="text-bubble" style={{ opacity: 0.7, fontStyle: 'italic' }}>
                                {interimTranscript} ...
                            </div>
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="message-wrapper model fade-in">
                        <div className="avatar">
                            <Bot size={18} />
                        </div>
                        <div className="message-content">
                            <div className="loading-bubble">
                                <Loader2 className="animate-spin" size={18} />
                                <span>Agent is thinking...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className={`voice-interaction-bar ${isRecording ? 'is-recording' : (isAgentSpeaking ? 'is-speaking' : (isLoading ? 'is-thinking' : (isConnected ? 'is-ready' : 'is-connecting')))}`} onClick={isConnected ? onToggleMicrophone : undefined}>
                <div className="voice-status-content">
                    {isConnected ? (
                        isRecording ? (
                            <>
                                <div className="pulse-ring">
                                    <Mic size={24} className="mic-icon active" />
                                </div>
                                <span className="voice-text">Listening... Tap to stop</span>
                            </>
                        ) : isAgentSpeaking ? (
                            <>
                                <div className="pulse-ring speaking">
                                    <Volume2 size={24} className="mic-icon active" style={{ color: '#8b5cf6' }} />
                                </div>
                                <span className="voice-text">Agent speaking... Tap to interrupt</span>
                            </>
                        ) : isLoading ? (
                            <>
                                <Loader2 size={24} className="animate-spin wait-icon" />
                                <span className="voice-text">Agent thinking...</span>
                            </>
                        ) : (
                            <>
                                <Mic size={24} className="mic-icon ready" />
                                <span className="voice-text">Agent ready. Tap to speak</span>
                            </>
                        )
                    ) : (
                        <>
                            <Loader2 size={24} className="animate-spin wait-icon" />
                            <span className="voice-text">Connecting to Live Agent...</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
