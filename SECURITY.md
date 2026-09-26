# Security Policy

## Security Principles

HuskyNote is built around strict local-first privacy:
- Zero Remote Storage by Default: Notes, transcripts, uploaded documents, and operation screenshots remain in the user's browser storage (IndexedDB).
- Safe Content Rendering: All markdown rendering enforces DOMPurify sanitization. Execution of arbitrary untrusted HTML or scripts is strictly prohibited.
- Local Network Boundaries: Network calls from the web client target only localhost (Ollama port 11434, local companion port 8765) or explicit user-configured endpoints.
- Least Privilege: Microphone and screen sharing APIs are triggered only with explicit user permission and accompanied by conspicuous visual indicators.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately to the maintainers rather than opening a public issue. We will review and address any issues promptly.
