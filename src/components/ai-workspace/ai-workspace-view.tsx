import React, { useState, useRef, useEffect } from 'react';
import type { AIContextChip, AIChatMessage } from '../../types';
import { ContextSelector } from './context-selector';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { ai } from '../../services/ai/active-provider';
import { db } from '../../db';
import { Button } from '../ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Save,
  CheckSquare,
  FileText,
  ListOrdered,
  AlertTriangle,
  Lightbulb,
  Trash2,
  Mic,
  MicOff,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';

export const AIWorkspaceView: React.FC = () => {
  const { isConnected, selectedModel } = useAI();
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();

  const [selectedChips, setSelectedChips] = useState<AIContextChip[]>([]);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);

  useEffect(() => {
    speechTranscriberRef.current = new LiveSpeechTranscriber();
    return () => {
      speechTranscriberRef.current?.stop();
    };
  }, []);

  const toggleVoiceInput = async () => {
    if (isListening) {
      speechTranscriberRef.current?.stop();
      setIsListening(false);
      addToast('Voice prompt input stopped.', 'info');
    } else {
      try {
        await speechTranscriberRef.current?.start((seg) => {
          setInputText((prev) => (prev ? `${prev} ${seg.text}` : seg.text));
        });
        setIsListening(true);
        addToast('Listening... Speak your prompt into the microphone.', 'success');
      } catch {
        addToast('Microphone access denied.', 'error');
      }
    }
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addChip = (chip: AIContextChip) => {
    if (!selectedChips.some((c) => c.id === chip.id)) {
      setSelectedChips((prev) => [...prev, chip]);
    }
  };

  const removeChip = (chipId: string) => {
    setSelectedChips((prev) => prev.filter((c) => c.id !== chipId));
  };

  const sendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isStreaming) return;

    if (!isConnected || !selectedModel) {
      addToast('Local AI (Ollama) is not connected. Check Settings to connect.', 'error');
      return;
    }

    const userMsg: AIChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    const assistantMsgId = `msg-${Date.now() + 1}`;
    const assistantPlaceholder: AIChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      sources: selectedChips.map((c) => ({ title: c.title })),
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInputText('');
    setIsStreaming(true);

    try {
      // Assemble context into system or prompt header
      let combinedPrompt = '';
      if (selectedChips.length > 0) {
        combinedPrompt += `GROUNDING WORKSPACE CONTEXT:\n`;
        selectedChips.forEach((chip) => {
          combinedPrompt += `--- [${chip.type.toUpperCase()}: ${chip.title}] ---\n${chip.content}\n\n`;
        });
        combinedPrompt += `INSTRUCTION: Base your answer strictly on the above workspace context whenever applicable.\n\n`;
      }
      combinedPrompt += `USER REQUEST: ${textToSend}`;

      let streamedText = '';
      await ai.streamGenerate(
        combinedPrompt,
        (chunk) => {
          streamedText += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamedText } : m))
          );
        },
        { model: selectedModel }
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `Error: ${err?.message || 'Failed to generate response'}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const executeCommand = (command: string) => {
    if (selectedChips.length === 0) {
      addToast('Attach at least one note, meeting, or document context chip first.', 'warning');
      return;
    }
    sendMessage(command);
  };

  const handleSaveAsNote = async (content: string) => {
    try {
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `AI Synthesis (${new Date().toLocaleDateString()})`,
        content: `# AI Workspace Synthesis\n\n${content}\n\n---\n*Generated by HuskyNote with model ${selectedModel}*`,
        tags: ['ai-synthesis', 'workspace'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [],
      });
      addToast('Saved response as a new Note.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
    } catch {
      addToast('Failed to save response to notes.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black select-none">
      {/* Top Context Selector Chips */}
      <ContextSelector
        selectedChips={selectedChips}
        onAddChip={addChip}
        onRemoveChip={removeChip}
      />

      {/* Context-Aware Command Toolbar */}
      <div className="px-6 py-2 border-b dark:border-zinc-850 flex items-center gap-1.5 overflow-x-auto bg-zinc-950/60 shrink-0 text-xs">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">
          Commands:
        </span>
        <button
          onClick={() => executeCommand('Provide a comprehensive synthesis and executive summary of the attached context.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white dark:hover:bg-zinc-850 transition-colors"
        >
          <FileText className="w-3 h-3 text-zinc-400" />
          <span>Summarize</span>
        </button>
        <button
          onClick={() => executeCommand('Extract all actionable tasks, deliverables, and owners into a structured task list.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white dark:hover:bg-zinc-850 transition-colors"
        >
          <CheckSquare className="w-3 h-3 text-zinc-400" />
          <span>Extract Tasks</span>
        </button>
        <button
          onClick={() => executeCommand('Generate a step-by-step Standard Operating Procedure (SOP) based on the procedures described.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white dark:hover:bg-zinc-850 transition-colors"
        >
          <ListOrdered className="w-3 h-3 text-zinc-400" />
          <span>Create SOP</span>
        </button>
        <button
          onClick={() => executeCommand('Identify all key decisions and agreements documented in this context.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white dark:hover:bg-zinc-850 transition-colors"
        >
          <Lightbulb className="w-3 h-3 text-zinc-400" />
          <span>Find Decisions</span>
        </button>
        <button
          onClick={() => executeCommand('Highlight potential risks, vulnerabilities, or open blockers present in the attached materials.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white dark:hover:bg-zinc-850 transition-colors"
        >
          <AlertTriangle className="w-3 h-3 text-zinc-400" />
          <span>Find Risks</span>
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 text-xs max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">AI Workspace</h3>
            <p className="leading-relaxed mb-4">
              Ground your queries by attaching notes, meetings, and documents from your local workspace.
              Responses run through your local Ollama models with zero external cloud transmission.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`rounded-xl p-4 text-xs leading-relaxed max-w-2xl border ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
                    : 'bg-zinc-950 text-zinc-200 dark:border-zinc-850 space-y-3'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <>
                    <div className="prose prose-invert max-w-none text-xs leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {DOMPurify.sanitize(msg.content || (isStreaming ? 'Thinking...' : ''))}
                      </ReactMarkdown>
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-2 border-t dark:border-zinc-850 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>Grounding: {msg.sources.map((s) => s.title).join(', ')}</span>
                        {msg.content && !isStreaming && (
                          <button
                            onClick={() => handleSaveAsNote(msg.content)}
                            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Save className="w-3 h-3" />
                            <span>Save as Note</span>
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div>{msg.content}</div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg dark:bg-zinc-850 border dark:border-zinc-750 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t dark:border-zinc-850 bg-zinc-950">
        <div className="max-w-4xl mx-auto flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
          <input
            type="text"
            placeholder={
              isConnected
                ? `Ask AI using model "${selectedModel}" (attach context above)...`
                : 'Local AI disconnected. Check settings to connect.'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!isConnected || isStreaming}
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2 rounded-lg border transition-all ${
              isListening
                ? 'bg-red-950/80 border-red-700 text-white animate-pulse'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
            title={isListening ? 'Stop voice input' : 'Speak prompt with microphone'}
          >
            {isListening ? <Mic className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => sendMessage()}
            disabled={!isConnected || isStreaming || !inputText.trim()}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
