'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function Twin() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    session_id: sessionId || undefined,
                }),
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();

            if (!sessionId) {
                setSessionId(data.session_id);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden relative font-sans">
            {/* Subtle Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
            </div>

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 p-4 z-10">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3 transition-transform hover:rotate-0">
                            <Bot className="w-7 h-7 text-white" />
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            Naheem Quadri
                            <Sparkles className="w-4 h-4 text-amber-400" />
                        </h2>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium mt-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Digital Twin Online
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 z-10 scroll-smooth">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-in fade-in duration-700">
                        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-3">
                            <Bot className="w-10 h-10 text-indigo-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">Hello! I&apos;m your Digital Twin.</h3>
                        <p className="text-slate-500 max-w-sm">
                            Ask me anything about my career, projects, or technical experience. I&apos;m here to chat!
                        </p>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 sm:gap-4 ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                        } animate-in slide-in-from-bottom-2 duration-300`}
                    >
                        {message.role === 'assistant' && (
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-full flex items-center justify-center shadow-md">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        )}

                        <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div
                                className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 text-sm sm:text-base shadow-sm ${
                                    message.role === 'user'
                                        ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                                }`}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            </div>
                            <span
                                className={`text-[11px] font-medium mt-1.5 px-1 ${
                                    message.role === 'user' ? 'text-slate-400' : 'text-slate-400'
                                }`}
                            >
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="flex gap-4 justify-start animate-in fade-in duration-300">
                        <div className="flex-shrink-0 mt-1">
                            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-full flex items-center justify-center shadow-md">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white/80 backdrop-blur-xl border-t border-slate-200/60 p-4 sm:p-5 z-10">
                <div className="relative flex items-center max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask me anything..."
                        className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:bg-white transition-all shadow-sm text-slate-700 placeholder:text-slate-400"
                        disabled={isLoading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </div>
                <div className="text-center mt-3">
                    <p className="text-[11px] text-slate-400 font-medium">
                    © {new Date().getFullYear()} Naheem Quadri
                    </p>
                </div>
            </div>
        </div>
    );
}