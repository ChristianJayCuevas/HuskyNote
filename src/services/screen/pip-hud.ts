/**
 * Document Picture-in-Picture Service
 * Provides an always-on-top floating desktop window on macOS/Windows
 * that stays visible over all other applications.
 */

let pipWindowInstance: any = null;

export function isDocumentPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

export function isPipHudActive(): boolean {
  return pipWindowInstance !== null && !pipWindowInstance.closed;
}

export function closePipHudWindow(): void {
  if (pipWindowInstance && !pipWindowInstance.closed) {
    try {
      pipWindowInstance.close();
    } catch {
      // ignore
    }
  }
  pipWindowInstance = null;
}

/**
 * Copies all active style sheets from the main document to the PiP window document.
 */
function copyStylesToPip(pipDoc: Document): void {
  // Copy <link rel="stylesheet">
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const newLink = pipDoc.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = (link as HTMLLinkElement).href;
    pipDoc.head.appendChild(newLink);
  });

  // Copy <style> elements
  document.querySelectorAll('style').forEach((style) => {
    const newStyle = pipDoc.createElement('style');
    newStyle.textContent = style.textContent;
    pipDoc.head.appendChild(newStyle);
  });
}

/**
 * Requests and opens the floating Document Picture-in-Picture window.
 * Returns the container div inside the floating window where React can render.
 */
export async function openPipHudWindow(
  options: {
    width?: number;
    height?: number;
    onClose?: () => void;
  } = {}
): Promise<HTMLElement | null> {
  if (!isDocumentPipSupported()) {
    console.warn('[HuskyNote] Document Picture-in-Picture is not supported in this browser.');
    return null;
  }

  // If already open, focus it
  if (pipWindowInstance && !pipWindowInstance.closed) {
    pipWindowInstance.focus();
    return pipWindowInstance.document.getElementById('huskynote-pip-root');
  }

  const width = options.width || 420;
  const height = options.height || 220;

  try {
    const pipWin = await (window as any).documentPictureInPicture.requestWindow({
      width,
      height,
    });

    pipWindowInstance = pipWin;

    // Apply dark canvas background to PiP body
    pipWin.document.body.style.margin = '0';
    pipWin.document.body.style.padding = '0';
    pipWin.document.body.style.overflow = 'hidden';
    // design-exception: the PiP window starts without the app stylesheet; matches the dark --background (#191919)
    pipWin.document.body.style.background = '#191919';
    pipWin.document.body.style.fontFamily =
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Set title
    pipWin.document.title = 'HuskyNote Quick Bar';

    // Copy styles from main document
    copyStylesToPip(pipWin.document);

    // Create root container
    const root = pipWin.document.createElement('div');
    root.id = 'huskynote-pip-root';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    pipWin.document.body.appendChild(root);

    pipWin.addEventListener('pagehide', () => {
      pipWindowInstance = null;
      if (options.onClose) options.onClose();
    });

    return root;
  } catch (err) {
    console.error('[HuskyNote] Failed to open Document Picture-in-Picture window:', err);
    return null;
  }
}
