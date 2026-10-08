import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { AIContextChip, AIChatMessage } from '../../types';
import { ContextSelector } from './context-selector';
import { useAI } from '../../context/ai-context';
import { PROVIDER_NAMES, PROVIDER_RECIPIENTS } from '../../services/ai/active-provider';
import { useWorkspace } from '../../context/workspace-context';
import { ai } from '../../services/ai/active-provider';
import { db } from '../../db';
import { SETTINGS_TAB_STORAGE_KEY } from '../../views/settings-view';
import { HuskyMark } from '@/brand';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { AiStatusBadge } from '../ui/ai-status-badge';
import { Badge } from '../ui/badge';
import { Markdown } from '../ui/markdown';
import { SimpleTooltip } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { autoGrowTextarea } from '../notes/auto-grow-textarea';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  Sparkles,
  Save,
  CheckSquare,
  FileText,
  ListOrdered,
  AlertTriangle,
  Lightbulb,
  Mic,
  SquarePen,
  Unplug,
  type LucideIcon,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';

/** One-click prompts that run against the attached context (same prompts as before the redesign) */
const COMMANDS: Array<{ label: string; icon: LucideIcon; prompt: string }> = [
  { label: 'Summarize', icon: FileText, prompt: 'Provide a comprehensive synthesis and executive summary of the attached context.' },
  { label: 'Extract Tasks', icon: CheckSquare, prompt: 'Extract all actionable tasks, deliverables, and owners into a structured task list.' },
  { label: 'Create SOP', icon: ListOrdered, prompt: 'Generate a step-by-step Standard Operating Procedure (SOP) based on the procedures described.' },
  { label: 'Find Decisions', icon: Lightbulb, prompt: 'Identify all key decisions and agreements documented in this context.' },
  { label: 'Find Risks', icon: AlertTriangle, prompt: 'Highlight potential risks, vulnerabilities, or open blockers present in the attached materials.' },
];

export const AIWorkspaceView: React.FC = () => {
  const { isConnected, isChecking, selectedModel, provider } = useAI();
  const providerName = PROVIDER_NAMES[provider];
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();

  const [selectedChips, setSelectedChips] = useState<AIContextChip[]>([]);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);

  useEffect(() => {
    speechTranscriberRef.current = new LiveSpeechTranscriber();
    return () => {
      speechTranscriberRef.current?.stop();
    };
  }, []);

  // The composer grows with the prompt or its placeholder (capped by its max height)
  useLayoutEffect(() => {
    autoGrowTextarea(composerRef.current);
  }, [inputText, isConnected, selectedModel, providerName]);
  useEffect(() => {
    const regrow = () => autoGrowTextarea(composerRef.current);
    window.addEventListener('resize', regrow);
    void document.fonts?.ready.then(regrow);
    return () => window.removeEventListener('resize', regrow);
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
      addToast(`${providerName} is not connected. Check Settings to connect.`, 'error');
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

  /** Opens Settings on the AI tab, where the Claude key or Ollama connection is set up */
  const openAiSettings = () => {
    window.dispatchEvent(new CustomEvent('huskynote:settings-tab', { detail: 'ai' }));
    try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, 'ai'); } catch { /* URL remains the fallback */ }
    setActiveView('settings');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'ai');
    window.history.replaceState(window.history.state, '', url.toString());
  };

  const hasMessages = messages.length > 0;
  const canSend = isConnected && !isStreaming && !!inputText.trim();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header row */}
      <div className="flex h-11 shrink-0 items-center gap-2 px-4">
        <AiStatusBadge variant="pill" onClick={openAiSettings} />
        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={isStreaming}
            className="ml-auto text-muted-foreground"
          >
            <SquarePen />
            New chat
          </Button>
        )}
      </div>

      {/* Conversation */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        {!hasMessages ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-3 py-10">
            <HuskyMark size={40} className="mb-4" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ground your queries by attaching notes, meetings, and documents from your local workspace.{' '}
              {PROVIDER_RECIPIENTS[provider]
                ? `Attached content is sent to ${PROVIDER_RECIPIENTS[provider]} to answer.`
                : 'Answers run on this computer through Ollama, so nothing leaves your device.'}
            </p>

            <div className="-mx-2 mt-8">
              <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">Commands</div>
              <div className="flex max-w-sm flex-col">
                {COMMANDS.map(({ label, icon: Icon, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => executeCommand(prompt)}
                    className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
            <h1 className="sr-only">AI Workspace</h1>
            {messages.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex h-6 items-center text-xs font-medium text-muted-foreground">HuskyNote AI</div>
                    {msg.content ? (
                      <Markdown size="sm">{msg.content}</Markdown>
                    ) : isStreaming ? (
                      <p className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none">Thinking…</p>
                    ) : null}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs text-muted-foreground">Grounding:</span>
                        {msg.sources.map((s, i) => (
                          <Badge key={`${s.title}-${i}`} variant="secondary" className="max-w-[14rem]">
                            <span className="truncate">{s.title}</span>
                          </Badge>
                        ))}
                        {msg.content && !isStreaming && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleSaveAsNote(msg.content)}
                            className="ml-auto text-muted-foreground"
                          >
                            <Save />
                            <span>Save as Note</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer (keeps clear of the companion button where the column reaches the bottom-right corner) */}
      <div className="shrink-0 px-4 pb-4 sm:px-6 max-xl:group-data-[mascot=true]/main:pb-16">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {!isConnected && !isChecking && (
            <Alert role="status" className="items-center py-2.5">
              <Unplug />
              <div className="col-start-2 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{providerName} is not connected.</span>{' '}
                  <span className="text-muted-foreground">
                    {provider === 'claude'
                      ? 'Add your Claude API key in Settings to start chatting.'
                      : provider === 'codex'
                        ? 'Sign in with ChatGPT in Settings to start chatting.'
                        : 'Start Ollama on this computer, or choose another provider in Settings.'}
                  </span>
                </span>
                <Button size="xs" variant="outline" onClick={openAiSettings} className="shrink-0">
                  Open Settings
                </Button>
              </div>
            </Alert>
          )}

          <div className="rounded-xl border border-input bg-background shadow-sm transition-[border-color,box-shadow] duration-100 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
            <ContextSelector selectedChips={selectedChips} onAddChip={addChip} onRemoveChip={removeChip} />

            <textarea
              ref={composerRef}
              rows={1}
              aria-label="Message HuskyNote AI"
              placeholder={
                isConnected
                  ? `Ask AI using model "${selectedModel}" (attach context above)...`
                  : `${providerName} is not connected. Check Settings to connect.`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={!isConnected || isStreaming}
              className="block max-h-[10.5rem] min-h-10 w-full resize-none overflow-y-auto bg-transparent px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed"
            />

            <div className="flex items-center gap-1 px-2 pb-2">
              <DropdownMenu>
                <SimpleTooltip content="Commands">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="AI commands" className="text-muted-foreground">
                      <Sparkles />
                    </Button>
                  </DropdownMenuTrigger>
                </SimpleTooltip>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel>Commands</DropdownMenuLabel>
                  {COMMANDS.map(({ label, icon: Icon, prompt }) => (
                    <DropdownMenuItem key={label} onSelect={() => executeCommand(prompt)}>
                      <Icon />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="min-w-0 truncate px-1 text-xs text-muted-foreground">
                {providerName}
                {selectedModel ? ` · ${selectedModel}` : ''}
              </span>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleVoiceInput}
                  aria-pressed={isListening}
                  className={cn(
                    isListening
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                      : 'text-muted-foreground'
                  )}
                  title={isListening ? 'Stop voice input' : 'Speak prompt with microphone'}
                >
                  <Mic className={cn(isListening && 'animate-pulse motion-reduce:animate-none')} />
                </Button>

                <Button
                  size="icon-sm"
                  variant="default"
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  aria-label="Send"
                  title="Send (Enter)"
                  className="rounded-full"
                >
                  <ArrowUp />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
