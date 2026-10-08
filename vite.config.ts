import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import { handleCodexRequest } from './server/codex-bridge';
import { handleClaudeRequest } from './server/claude-bridge';

// parakeet.js pins its own onnxruntime-web (it may be nested under parakeet.js
// rather than hoisted), and its runtime files must match that exact version
const requireFromHere = createRequire(import.meta.url);
const parakeetOrtDist = path.dirname(
  requireFromHere.resolve('onnxruntime-web', { paths: [path.dirname(requireFromHere.resolve('parakeet.js'))] })
);

function chromeExtensionInstallerPlugin() {
  return {
    name: 'huskynote-chrome-extension-installer',
    configureServer(server: any) {
      console.log('[Extension Installer] configureServer initialized');
      let latestMeetingRoster: any = null;

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';

        // Direct binary downloads with explicit Content-Disposition and MIME types
        if (url.startsWith('/downloads/')) {
          const rawFilename = path.basename(url.split('?')[0]);
          const filePath = path.resolve(__dirname, 'public/downloads', rawFilename);
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const contentType = rawFilename.endsWith('.dmg')
              ? 'application/x-apple-diskimage'
              : rawFilename.endsWith('.exe')
              ? 'application/x-msdownload'
              : rawFilename.endsWith('.zip')
              ? 'application/zip'
              : 'application/octet-stream';

            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': stat.size,
              'Content-Disposition': `attachment; filename="${rawFilename}"`,
              'Access-Control-Allow-Origin': '*',
            });
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        // Real-time meeting sync endpoint for companion extension & cross-origin tabs
        if (url.startsWith('/api/meeting-sync')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                latestMeetingRoster = {
                  ...parsed,
                  receivedAt: Date.now(),
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(latestMeetingRoster || {}));
            return;
          }
        }

        if (url.startsWith('/api/chrome-extension/auto-install')) {
          const extensionDir = path.resolve(__dirname, 'browser-extension');
          const userDownloads = path.join(process.env.HOME || '', 'Downloads', 'HuskyNote-Chrome-Extension');
          const userDesktop = path.join(process.env.HOME || '', 'Desktop', 'HuskyNote-Chrome-Extension');

          // 1. Copy unpacked extension directly into user's ~/Downloads and ~/Desktop folders so it appears immediately
          exec(`rm -rf "${userDownloads}" "${userDesktop}" && cp -r "${extensionDir}" "${userDownloads}" && cp -r "${extensionDir}" "${userDesktop}"`, () => {
            // 2. Reveal in Finder
            exec(`open -R "${path.join(userDownloads, 'manifest.json')}"`, () => {});
          });

          // 3. Open chrome://extensions in Google Chrome via AppleScript
          exec(`osascript -e 'tell application "Google Chrome" to open location "chrome://extensions"'`, () => {});

          // 4. Copy Downloads extension path to macOS clipboard
          exec(`printf "%s" "${userDownloads}" | pbcopy`, () => {});

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Extension folder created in Downloads and revealed in Finder!',
              path: userDownloads,
            })
          );
          return;
        }

        if (url.startsWith('/api/chrome-extension/launch-browser')) {
          const extensionDir = path.resolve(__dirname, 'browser-extension');

          exec(
            `open -na "Google Chrome" --args --load-extension="${extensionDir}" "http://127.0.0.1:5173/?view=settings"`,
            (err: any) => {
              if (err) {
                exec(`open -a "Google Chrome" --args --load-extension="${extensionDir}" "http://127.0.0.1:5173/?view=settings"`);
              }
            }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Chrome launched with HuskyNote extension preloaded!',
              path: extensionDir,
            })
          );
          return;
        }

        if (url.startsWith('/api/chrome-extension/open-extensions-page')) {
          exec(`osascript -e 'tell application "Google Chrome" to open location "chrome://extensions"'`, () => {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (url.startsWith('/api/chrome-extension/reveal-folder')) {
          const extensionDir = path.resolve(__dirname, 'browser-extension');
          exec(`open -R "${path.join(extensionDir, 'manifest.json')}"`, () => {});
          exec(`printf "%s" "${extensionDir}" | pbcopy`, () => {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: extensionDir }));
          return;
        }

        if (url.startsWith('/api/chrome-extension/download-zip')) {
          const zipPath = path.resolve(__dirname, 'public/downloads/HuskyNote-Chrome-Extension.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Length': stat.size,
              'Content-Disposition': 'attachment; filename="HuskyNote-Chrome-Extension.zip"',
            });
            fs.createReadStream(zipPath).pipe(res);
            return;
          }
        }

        if (url.startsWith('/api/chrome-extension/download-script')) {
          const scriptPath = path.resolve(__dirname, 'browser-extension/setup-extension.command');
          if (fs.existsSync(scriptPath)) {
            const stat = fs.statSync(scriptPath);
            res.writeHead(200, {
              'Content-Type': 'application/x-sh',
              'Content-Length': stat.size,
              'Content-Disposition': 'attachment; filename="Setup-HuskyNote-Extension.command"',
            });
            fs.createReadStream(scriptPath).pipe(res);
            return;
          }
        }

        next();
      });
    },
  };
}

/** Subscription providers through their official CLIs on this computer. */
function subscriptionBridgePlugin() {
  const use = (server: any) => {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (!handleCodexRequest(req, res) && !handleClaudeRequest(req, res)) next();
    });
  };
  return { name: 'huskynote-subscription-bridges', configureServer: use, configurePreviewServer: use };
}

// https://vitejs.dev/config/
const appVersion: string = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), chromeExtensionInstallerPlugin(), subscriptionBridgePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'parakeet-ort-dist': parakeetOrtDist,
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdfjs-vendor': ['pdfjs-dist'],
          'markdown-vendor': ['react-markdown', 'remark-gfm', 'dompurify'],
          'export-vendor': ['jspdf'],
          // UI primitives (Radix, cmdk, cva) change rarely; a separate chunk stays cached across app updates
          'ui-vendor': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
            'class-variance-authority',
            'cmdk',
          ],
        },
      },
    },
  },
  // The Whisper worker code-splits transformers.js, which needs ES module workers
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    // Served as-is: the Parakeet worker sets the runtime path on the same onnxruntime-web
    // instance parakeet.js imports, which pre-bundling would split into separate copies
    exclude: ['@huggingface/transformers', 'parakeet.js', 'parakeet-ort-dist'],
  },
});
