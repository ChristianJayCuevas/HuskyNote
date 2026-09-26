/**
 * HuskyNote Desktop — macOS Native Application Shell
 * ===================================================
 * A lightweight macOS app that wraps the HuskyNote web application inside
 * a WKWebView and provides native menu bar integration.
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  NSStatusBar item (menu bar HUD)                            │
 * │  NSWindow → WKWebView → HuskyNote React app                  │
 * │  Local HTTP server (Python 3 http.server OR swift-served)   │
 * │  Ollama health monitor (polls localhost:11434 every 8s)     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * LOADING STRATEGY:
 * 1. `--dev` flag: Connect to Vite dev server on ports 5176/5173/5174/5175
 * 2. Bundled web assets: Start a local HTTP server on port 5892
 *    - Primary: Python 3 (`/usr/bin/python3 -m http.server`)
 *    - Fallback: Try `python3` from common Homebrew/macOS paths
 * 3. Dev server fallback: Check common ports if bundle missing
 *
 * macOS COMPATIBILITY:
 * - Supports macOS 12.0 (Monterey) and later
 * - Universal binary compatible with both Intel x86_64 and Apple Silicon arm64
 * - WKWebView media capture permission auto-granted for screen recording
 * - Window persists in menu bar on close (like Ollama.app)
 *
 * OLLAMA INTEGRATION:
 * - Health check polls `http://127.0.0.1:11434/api/tags` every 8 seconds
 * - Menu bar icon status pill updates between "AI Active" and "AI Ready"
 *
 * BUILD:
 * `.github/workflows/build-macos.yml` compiles the universal binary, assembles
 * HuskyNote.app (Info.plist, AppIcon.icns, bundled `web/` assets) and the .dmg files.
 * To compile locally:
 *   swiftc main.swift -o HuskyNote -framework Cocoa -framework WebKit
 *
 * SIGN & NOTARIZE (for distribution):
 *   codesign --deep --force --options runtime \
 *     --entitlements entitlements.plist \
 *     --sign "Developer ID Application: <Your Name>" \
 *     HuskyNote.app
 *   xcrun altool --notarize-app ...
 */

import Cocoa
import WebKit

// ─────────────────────────────────────────────────────────────────────────────
// AppDelegate — NSApplication lifecycle and window management
// ─────────────────────────────────────────────────────────────────────────────

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate {

    // MARK: - Properties

    var window: NSWindow!
    var webView: WKWebView!
    var localServerProcess: Process?
    var statusItem: NSStatusItem!

    /// True when Ollama is reachable at localhost:11434
    var isOllamaOnline: Bool = false

    /// Periodic timer that checks Ollama health
    var ollamaHealthTimer: Timer?

    /// Port used by the local Python static server (bundled web assets)
    let staticServerPort: Int = 5892

    // MARK: - Application Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)

        // ── Window Setup ──────────────────────────────────────────────────
        let screenSize = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1440, height: 900)
        let windowWidth: CGFloat = min(1360, screenSize.width * 0.92)
        let windowHeight: CGFloat = min(880, screenSize.height * 0.88)

        let rect = NSRect(
            x: (screenSize.width - windowWidth) / 2,
            y: (screenSize.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "HuskyNote"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.backgroundColor = .black
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.center()

        // ── WKWebView Configuration ───────────────────────────────────────
        let config = WKWebViewConfiguration()

        // Allow media (audio/video) to autoplay without user gesture
        config.mediaTypesRequiringUserActionForPlayback = []

        // Enable Web Inspector for debugging (harmless in production)
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        // Enable element fullscreen API (required for PDF viewer fullscreen)
        if #available(macOS 12.3, *) {
            config.preferences.isElementFullscreenEnabled = true
        }

        // ── WebView Instantiation ─────────────────────────────────────────
        webView = WKWebView(frame: rect, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self

        // Automatically resize with the window (critical for layout correctness)
        webView.autoresizingMask = [.width, .height]

        // Set transparent background so the React app controls all colors
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView = webView

        // ── Menu Bar Status Item ──────────────────────────────────────────
        setupStatusBar()

        // ── Load HuskyNote Web App ─────────────────────────────────────────
        loadHuskyNote()

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - Menu Bar (HUD)

    /**
     * setupStatusBar
     * Creates the menu bar status item with the HuskyNote icon.
     * Also starts a repeating health timer for the Ollama service.
     */
    func setupStatusBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = createStatusBarIcon()
            button.imagePosition = .imageOnly
            button.toolTip = "HuskyNote — Your Personal AI Secretary"
        }

        updateMenu()

        // Poll Ollama health every 8 seconds to keep the menu status current
        ollamaHealthTimer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: true) { [weak self] _ in
            self?.checkOllamaHealth()
        }
        checkOllamaHealth()
    }

    /**
     * createStatusBarIcon
     * Draws the HuskyNote mascot (a husky face with pointed ears) as a template image
     * suitable for both light and dark menu bars.
     *
     * Coordinates are in 18×18 points. The `isTemplate = true` flag lets
     * macOS automatically invert the icon for dark/light appearance.
     */
    func createStatusBarIcon() -> NSImage {
        let size = NSSize(width: 18, height: 18)
        let image = NSImage(size: size, flipped: false) { rect in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            ctx.saveGState()

            let color = NSColor.black.cgColor
            ctx.setFillColor(color)
            ctx.setStrokeColor(color)

            // 1. Pointed ears
            for ear in [
                [CGPoint(x: 2.4, y: 10.5), CGPoint(x: 3.4, y: 17.2), CGPoint(x: 7.4, y: 13.2)],
                [CGPoint(x: 15.6, y: 10.5), CGPoint(x: 14.6, y: 17.2), CGPoint(x: 10.6, y: 13.2)],
            ] {
                ctx.move(to: ear[0])
                ctx.addLine(to: ear[1])
                ctx.addLine(to: ear[2])
                ctx.closePath()
                ctx.fillPath()
            }

            // 3. Head Outline (Rounded pill / face)
            let headRect = CGRect(x: 2.0, y: 2.0, width: 14.0, height: 12.0)
            let headPath = CGPath(roundedRect: headRect, cornerWidth: 5.5, cornerHeight: 5.5, transform: nil)
            ctx.addPath(headPath)
            ctx.setLineWidth(1.6)
            ctx.strokePath()

            // 4. Husky forehead marking (dark cap with a point between the eyes)
            ctx.move(to: CGPoint(x: 5.0, y: 13.4))
            ctx.addLine(to: CGPoint(x: 13.0, y: 13.4))
            ctx.addLine(to: CGPoint(x: 9.0, y: 9.0))
            ctx.closePath()
            ctx.fillPath()

            // 5. Eyes
            let leftEye = CGRect(x: 4.6, y: 7.0, width: 2.4, height: 2.4)
            let rightEye = CGRect(x: 11.0, y: 7.0, width: 2.4, height: 2.4)
            ctx.fillEllipse(in: leftEye)
            ctx.fillEllipse(in: rightEye)

            // 6. Nose
            let nose = CGRect(x: 8.1, y: 4.8, width: 1.8, height: 1.4)
            ctx.fillEllipse(in: nose)

            ctx.restoreGState()
            return true
        }
        image.isTemplate = true
        return image
    }

    /**
     * updateMenu
     * Rebuilds the menu bar dropdown. Called on launch and whenever the
     * Ollama connection status changes.
     */
    func updateMenu() {
        let menu = NSMenu()
        menu.autoenablesItems = false

        // Custom header with title, subtitle, and AI status pill
        let headerItem = NSMenuItem()
        headerItem.view = createHeaderView()
        menu.addItem(headerItem)

        menu.addItem(NSMenuItem.separator())

        // Quick navigation actions
        let openItem = NSMenuItem(title: "Open HuskyNote", action: #selector(openHuskyNoteWindow), keyEquivalent: "o")
        openItem.target = self
        menu.addItem(openItem)

        let newNoteItem = NSMenuItem(title: "New Note", action: #selector(menuNewNote), keyEquivalent: "n")
        newNoteItem.target = self
        menu.addItem(newNoteItem)

        let focusItem = NSMenuItem(title: "Husky Notes Focus Mode", action: #selector(menuFocusMode), keyEquivalent: "N")
        focusItem.keyEquivalentModifierMask = [.command, .shift]
        focusItem.target = self
        menu.addItem(focusItem)

        let meetingItem = NSMenuItem(title: "Start Meeting / Voice Note", action: #selector(menuStartMeeting), keyEquivalent: "m")
        meetingItem.target = self
        menu.addItem(meetingItem)

        let scheduleItem = NSMenuItem(title: "Schedule & Calendar", action: #selector(menuSchedule), keyEquivalent: "S")
        scheduleItem.keyEquivalentModifierMask = [.command, .shift]
        scheduleItem.target = self
        menu.addItem(scheduleItem)

        let studioItem = NSMenuItem(title: "Screen Recorder Studio", action: #selector(menuStudio), keyEquivalent: "R")
        studioItem.keyEquivalentModifierMask = [.command, .shift]
        studioItem.target = self
        menu.addItem(studioItem)

        let hudItem = NSMenuItem(title: "Toggle Quick Bar", action: #selector(menuToggleHud), keyEquivalent: "H")
        hudItem.keyEquivalentModifierMask = [.command, .shift]
        hudItem.target = self
        menu.addItem(hudItem)

        menu.addItem(NSMenuItem.separator())

        // System / Settings
        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(menuSettings), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        let aboutItem = NSMenuItem(title: "About HuskyNote", action: #selector(menuAbout), keyEquivalent: "")
        aboutItem.target = self
        menu.addItem(aboutItem)

        menu.addItem(NSMenuItem.separator())

        // Quit
        let quitItem = NSMenuItem(title: "Quit HuskyNote", action: #selector(menuQuit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    /**
     * createHeaderView
     * Returns a custom NSView for the top of the dropdown menu showing
     * the HuskyNote branding and live Ollama AI status indicator.
     */
    func createHeaderView() -> NSView {
        let headerView = NSView(frame: NSRect(x: 0, y: 0, width: 250, height: 54))

        // Title label
        let titleLabel = NSTextField(frame: NSRect(x: 14, y: 27, width: 140, height: 18))
        titleLabel.stringValue = "HuskyNote"
        titleLabel.font = NSFont.boldSystemFont(ofSize: 13)
        titleLabel.textColor = NSColor.labelColor
        titleLabel.isBezeled = false
        titleLabel.drawsBackground = false
        titleLabel.isEditable = false
        titleLabel.isSelectable = false
        headerView.addSubview(titleLabel)

        // Subtitle label
        let subtitleLabel = NSTextField(frame: NSRect(x: 14, y: 9, width: 220, height: 15))
        subtitleLabel.stringValue = "Your Personal AI Secretary"
        subtitleLabel.font = NSFont.systemFont(ofSize: 11)
        subtitleLabel.textColor = NSColor.secondaryLabelColor
        subtitleLabel.isBezeled = false
        subtitleLabel.drawsBackground = false
        subtitleLabel.isEditable = false
        subtitleLabel.isSelectable = false
        headerView.addSubview(subtitleLabel)

        // AI status pill (right-aligned)
        let statusPill = NSTextField(frame: NSRect(x: 140, y: 28, width: 96, height: 16))
        statusPill.stringValue = isOllamaOnline ? "● AI Active" : "● AI Ready"
        statusPill.alignment = .right
        statusPill.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .semibold)
        statusPill.textColor = isOllamaOnline ? NSColor.systemGreen : NSColor.secondaryLabelColor
        statusPill.isBezeled = false
        statusPill.drawsBackground = false
        statusPill.isEditable = false
        statusPill.isSelectable = false
        headerView.addSubview(statusPill)

        return headerView
    }

    /**
     * checkOllamaHealth
     * Sends a lightweight GET to /api/tags (the Ollama model list endpoint).
     * Updates `isOllamaOnline` and refreshes the menu if the status changed.
     * Timeout is 1 second to avoid blocking the main thread.
     */
    func checkOllamaHealth() {
        guard let url = URL(string: "http://127.0.0.1:11434/api/tags") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 1.0
        req.httpMethod = "GET"
        let task = URLSession.shared.dataTask(with: req) { [weak self] _, response, _ in
            let online = (response as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async {
                if self?.isOllamaOnline != online {
                    self?.isOllamaOnline = online
                    self?.updateMenu()
                }
            }
        }
        task.resume()
    }

    // MARK: - Menu Actions

    /// Brings the HuskyNote window to the front and activates the app
    @objc func openHuskyNoteWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func menuNewNote() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'notes', action: 'new' } }))",
            completionHandler: nil
        )
    }

    @objc func menuFocusMode() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'zen' } }))",
            completionHandler: nil
        )
    }

    @objc func menuStartMeeting() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'meetings', action: 'record' } }))",
            completionHandler: nil
        )
    }

    @objc func menuSchedule() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'schedule' } }))",
            completionHandler: nil
        )
    }

    @objc func menuStudio() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'studio' } }))",
            completionHandler: nil
        )
    }

    @objc func menuToggleHud() {
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:toggle-hud'))",
            completionHandler: nil
        )
    }

    @objc func menuSettings() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'settings' } }))",
            completionHandler: nil
        )
    }

    @objc func menuAbout() {
        openHuskyNoteWindow()
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('huskynote:navigate', { detail: { view: 'about' } }))",
            completionHandler: nil
        )
    }

    @objc func menuQuit() {
        localServerProcess?.terminate()
        NSApp.terminate(nil)
    }

    // MARK: - Navigation & Local Server

    /**
     * loadHuskyNote
     * Determines the correct URL to load and initiates navigation in WKWebView.
     *
     * Priority order:
     * 1. `--dev` flag → Vite dev server (ports 5176/5173/5174/5175)
     * 2. Bundled `web/` assets in app bundle → Python 3 static server on :5892
     * 3. Fallback → Try common dev server ports anyway
     * 4. Error page → Show a helpful inline HTML error if nothing works
     */
    func loadHuskyNote() {
        // ── Priority 1: Developer mode (--dev flag) ───────────────────────
        if CommandLine.arguments.contains("--dev") {
            let devPorts = [5176, 5173, 5174, 5175]
            for port in devPorts {
                if isPortOpen(port: port) {
                    if let url = URL(string: "http://127.0.0.1:\(port)") {
                        webView.load(URLRequest(url: url))
                        return
                    }
                }
            }
        }

        // ── Priority 2: Bundled web assets ────────────────────────────────
        if let resourcePath = Bundle.main.resourcePath {
            let webDir = (resourcePath as NSString).appendingPathComponent("web")
            let indexHtml = (webDir as NSString).appendingPathComponent("index.html")
            if FileManager.default.fileExists(atPath: indexHtml) {
                if startStaticServer(dir: webDir, port: staticServerPort) {
                    // Give the Python server slightly more time to bind the port.
                    // 0.6s is safe even on slow cold-start Intel Macs.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                        guard let self = self else { return }
                        if let url = URL(string: "http://127.0.0.1:\(self.staticServerPort)") {
                            self.webView.load(URLRequest(url: url))
                        }
                    }
                    return
                }
                // Python3 unavailable — load file:// directly (limited functionality)
                let fileUrl = URL(fileURLWithPath: indexHtml)
                webView.loadFileURL(fileUrl, allowingReadAccessTo: URL(fileURLWithPath: webDir))
                return
            }
        }

        // ── Priority 3: Fallback to common dev server ports ───────────────
        let ports = [5176, 5173, 5174, 5175]
        for port in ports {
            if isPortOpen(port: port) {
                if let url = URL(string: "http://127.0.0.1:\(port)") {
                    webView.load(URLRequest(url: url))
                    return
                }
            }
        }

        // ── Priority 4: Helpful error page ───────────────────────────────
        // Shown only when neither dev server nor bundled assets are available.
        // This is most common when running the bare binary without npm build.
        loadErrorPage()
    }

    /**
     * isPortOpen
     * Synchronously checks if a local HTTP port is responding within 400ms.
     * Uses a semaphore — call only from background or startup context.
     *
     * @param port  The TCP port to probe on 127.0.0.1
     * @returns     True if the port responded with HTTP < 500
     */
    func isPortOpen(port: Int) -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)") else { return false }
        var request = URLRequest(url: url)
        request.timeoutInterval = 0.3
        request.httpMethod = "HEAD"
        let semaphore = DispatchSemaphore(value: 0)
        var isOpen = false

        let task = URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode < 500 {
                isOpen = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 0.4)
        return isOpen
    }

    /**
     * startStaticServer
     * Spawns a Python 3 HTTP server to serve the bundled web assets from `dir`.
     *
     * Tries multiple Python 3 paths to cover:
     * - macOS built-in: /usr/bin/python3 (Intel + Silicon system Python)
     * - Homebrew arm64: /opt/homebrew/bin/python3 (Apple Silicon Homebrew)
     * - Homebrew x86:   /usr/local/bin/python3 (Intel Homebrew)
     *
     * @param dir   Absolute path to the directory to serve
     * @param port  TCP port to bind the server to
     * @returns     True if the server process was launched successfully
     */
    @discardableResult
    func startStaticServer(dir: String, port: Int) -> Bool {
        // Candidate Python 3 executables (in order of preference)
        let pythonCandidates = [
            "/usr/bin/python3",
            "/opt/homebrew/bin/python3",   // Apple Silicon Homebrew
            "/usr/local/bin/python3",      // Intel Homebrew
        ]

        for pythonPath in pythonCandidates {
            if FileManager.default.fileExists(atPath: pythonPath) {
                let p = Process()
                p.executableURL = URL(fileURLWithPath: pythonPath)
                p.arguments = ["-m", "http.server", String(port), "--directory", dir, "--bind", "127.0.0.1"]
                p.standardOutput = FileHandle.nullDevice
                p.standardError = FileHandle.nullDevice

                do {
                    try p.run()
                    self.localServerProcess = p
                    return true
                } catch {
                    // This python path failed (permissions or arg error) — try next
                    continue
                }
            }
        }

        // No Python 3 found on this system
        return false
    }

    /**
     * loadErrorPage
     * Loads a branded HTML error page directly into WKWebView when no
     * server could be started and no bundled assets were found.
     * Guides the user to start HuskyNote from the terminal.
     */
    func loadErrorPage() {
        let html = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>HuskyNote — Start Required</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: #000; color: #e5e5e5;
              display: flex; align-items: center; justify-content: center;
              min-height: 100vh; padding: 2rem;
            }
            .card {
              max-width: 480px; width: 100%;
              background: #111; border: 1px solid #333;
              border-radius: 16px; padding: 2rem; text-align: center;
            }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: .5rem; }
            p { font-size: .875rem; color: #888; line-height: 1.6; margin-bottom: 1rem; }
            code {
              display: block; background: #000; border: 1px solid #333;
              border-radius: 8px; padding: 1rem; font-family: 'SF Mono', monospace;
              font-size: .8rem; color: #ccc; text-align: left; margin-bottom: 1rem;
              white-space: pre;
            }
            .note { font-size: .75rem; color: #555; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🐾</div>
            <h1>HuskyNote needs a web server</h1>
            <p>
              The bundled web assets were not found and no development server is running.
              Start HuskyNote from the Terminal:
            </p>
            <code>cd HuskyNote<br>./start.sh</code>
            <p>Or in developer mode (after <code style="display:inline;padding:2px 6px">npm run build</code>):</p>
            <code>./HuskyNote --dev</code>
            <p class="note">
              Requires Node.js 18+ and optionally Python 3 for the bundled static server.
            </p>
          </div>
        </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: - WKWebView Delegates

    /**
     * webView(_:requestMediaCapturePermissionFor:...)
     * Auto-grants microphone and camera access to the HuskyNote web app.
     * This is required for the Meeting Recorder audio capture feature.
     * Available from macOS 12.0+.
     */
    @available(macOS 12.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        // Grant all media capture permissions automatically.
        // HuskyNote only uses the microphone for meeting recording.
        decisionHandler(.grant)
    }

    // MARK: - Window Delegate

    /**
     * windowShouldClose
     * Hides the window instead of closing it (like Ollama.app behavior).
     * The app stays alive in the menu bar until explicitly quit.
     */
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    /**
     * applicationShouldTerminateAfterLastWindowClosed
     * Returning false keeps the app running in the menu bar after the window is closed.
     */
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    /**
     * applicationWillTerminate
     * Cleanup: stop the Ollama health timer and the local Python server process.
     */
    func applicationWillTerminate(_ notification: Notification) {
        ollamaHealthTimer?.invalidate()
        localServerProcess?.terminate()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
