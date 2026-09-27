import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CodeBlockProps {
  title?: string;
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  title = 'TERMINAL',
  code,
  language = 'bash',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs select-text">
      <div className="flex items-center justify-between px-4 py-2 border-b dark:border-zinc-850 bg-zinc-900/60 select-none">
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
          <span>{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
          title="Copy command"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-zinc-300 leading-relaxed">
        <pre>{code}</pre>
      </div>
    </div>
  );
};
