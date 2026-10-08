import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const CLAUDE_SUBSCRIPTION_MODELS: {
    id: string;
    name: string;
    description: string;
}[];
/** Keep subscription requests independent of inherited API keys, gateways, and agent settings. */
export declare function claudeEnvironment(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
/** Text only: no tools, MCP servers, hooks, skills, browser, or saved sessions. */
export declare function claudeExecArgs(model?: string): string[];
export declare function readClaudeResult(output: string): {
    text: string;
    error: string;
};
/** Return account state only; never expose credentials or personal account details. */
export declare function readClaudeAuth(output: string, code: number | null): {
    loggedIn: boolean;
    authMethod?: 'subscription' | 'apikey';
};
interface Command {
    exe: string;
    prefix: string[];
}
/** Native installs and npm installs; npm shims are bypassed to avoid invoking a shell. */
export declare function findClaude(): Command | null;
export declare function handleClaudeRequest(req: IncomingMessage, res: ServerResponse): boolean;
export {};
