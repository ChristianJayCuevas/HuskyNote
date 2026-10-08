#!/usr/bin/env python3
"""
Static file server for the HuskyNote macOS and Linux apps.

Serves the bundled web app on 127.0.0.1 only. Content types for module
scripts and WebAssembly are set explicitly: browsers refuse to run a module
script served as anything other than JavaScript, and older Python versions
(such as the one macOS ships) do not know the .mjs extension.

Usage: serve.py PORT DIRECTORY
"""

import functools
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
    }

    def log_message(self, format, *args):
        # Keep the app's terminal and system log quiet
        pass


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: serve.py PORT DIRECTORY")
    port = int(sys.argv[1])
    handler = functools.partial(Handler, directory=sys.argv[2])
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
