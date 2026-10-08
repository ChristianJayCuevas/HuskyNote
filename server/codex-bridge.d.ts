import type { IncomingMessage, ServerResponse } from 'node:http';
/** `codex exec` arguments: text in, text out, nothing else */
export declare function codexExecArgs(workdir: string, model?: string): string[];
/** The answer in `codex exec --json` output: the last agent message, or why there is none */
export declare function readCodexEvents(jsonl: string): {
    text: string;
    error: string;
};
/** The Codex executable: on PATH, from the Codex app, or inside an npm install */
export declare function findCodex(): string | null;
/** Answers /api/codex/* requests; returns false for anything else */
export declare function handleCodexRequest(req: IncomingMessage, res: ServerResponse): boolean;
