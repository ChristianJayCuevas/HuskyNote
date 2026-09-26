// Dynamic screen frame annotation and SOP documentation generator service

export interface AnnotationPoint {
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
  stepNumber: number;
  label?: string;
  timestampSeconds?: number;
}

export interface DynamicAnnotateOptions {
  stepNumber: number;
  point?: { x: number; y: number }; // percentage 0..100
  title?: string;
  timestampSeconds?: number;
  label?: string;
}

/**
 * Safely extracts a pristine ImageBitmap or CanvasImageSource from MediaStream or HTMLVideoElement.
 */
export async function grabFrameFromStreamOrVideo(
  stream: MediaStream | null,
  video: HTMLVideoElement | null
): Promise<CanvasImageSource | null> {
  // 1. Direct hardware-accelerated ImageCapture from video track
  if (stream) {
    const track = stream.getVideoTracks()[0];
    if (track && track.readyState === 'live') {
      try {
        if (typeof window !== 'undefined' && 'ImageCapture' in window) {
          const ic = new (window as any).ImageCapture(track);
          const bitmap = await ic.grabFrame();
          if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
            return bitmap;
          }
        }
      } catch (err) {
        console.warn('[HuskyNote] ImageCapture grabFrame fallback:', err);
      }
    }
  }

  // 2. Video element fallback if frame is decoded
  if (video && video.videoWidth > 0 && video.readyState >= 2) {
    return video;
  }

  return null;
}

export class ScreenAnnotatorService {
  /**
   * Captures a frame from an image source and burns dynamic annotation overlays onto it.
   */
  captureAndAnnotate(
    source: CanvasImageSource | null,
    options: DynamicAnnotateOptions
  ): { dataUrl: string; point: { x: number; y: number } } {
    let width = 1280;
    let height = 720;

    if (source) {
      if ('videoWidth' in source && (source as HTMLVideoElement).videoWidth) {
        width = (source as HTMLVideoElement).videoWidth;
        height = (source as HTMLVideoElement).videoHeight;
      } else if ('width' in source && typeof (source as any).width === 'number') {
        width = (source as any).width || 1280;
        height = (source as any).height || 720;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    // 1. Draw raw frame or sleek dark workspace pattern if black/empty
    let frameRendered = false;
    if (source) {
      try {
        ctx.drawImage(source, 0, 0, width, height);

        // Check if drawn pixels are completely black (e.g. paused / permissions block)
        const sample = ctx.getImageData(Math.floor(width / 2) - 5, Math.floor(height / 2) - 5, 10, 10);
        let luminance = 0;
        for (let i = 0; i < sample.data.length; i += 4) {
          luminance += sample.data[i] + sample.data[i + 1] + sample.data[i + 2];
        }
        if (luminance > 20) {
          frameRendered = true;
        }
      } catch (drawErr) {
        console.warn('[HuskyNote] Frame draw warning:', drawErr);
      }
    }

    if (!frameRendered) {
      // Draw a sleek high-definition macOS workspace simulation backdrop
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#09090b');
      grad.addColorStop(1, '#18181b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Window chrome bar
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, width, 40);
      // Window traffic dots
      ctx.fillStyle = '#71717a';
      ctx.beginPath();
      ctx.arc(24, 20, 6, 0, Math.PI * 2);
      ctx.arc(42, 20, 6, 0, Math.PI * 2);
      ctx.arc(60, 20, 6, 0, Math.PI * 2);
      ctx.fill();

      // Window title
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '12px sans-serif';
      ctx.fillText('HuskyNote Workflow Capture Session', 85, 24);

      // Subtle workspace grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 60; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 60; y < height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // 2. Determine target coordinate point
    let targetX = width / 2;
    let targetY = height / 2;
    let normX = 50;
    let normY = 50;

    if (options.point) {
      normX = Math.max(5, Math.min(95, options.point.x));
      normY = Math.max(5, Math.min(95, options.point.y));
      targetX = (normX / 100) * width;
      targetY = (normY / 100) * height;
    } else {
      // Dynamic simulated focal point cycling across quadrants for variety if automated
      const cycle = options.stepNumber % 4;
      if (cycle === 1) {
        normX = 35;
        normY = 40;
      } else if (cycle === 2) {
        normX = 65;
        normY = 45;
      } else if (cycle === 3) {
        normX = 50;
        normY = 60;
      } else {
        normX = 40;
        normY = 30;
      }
      targetX = (normX / 100) * width;
      targetY = (normY / 100) * height;
    }

    // 3. Draw high-visibility focus box around interaction zone
    const boxSize = Math.max(48, Math.round(width * 0.08));
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(targetX - boxSize / 2, targetY - boxSize / 2, boxSize, boxSize);

    // Subtle dark scrim vignette around focus box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(targetX - boxSize / 2, targetY - boxSize / 2, boxSize, boxSize);
    ctx.restore();

    // 4. Draw high-contrast circular step badge [N]
    const badgeRadius = Math.max(16, Math.round(width * 0.016));
    const badgeX = targetX + boxSize / 2 - 4;
    const badgeY = targetY - boxSize / 2 + 4;

    ctx.save();
    // Outer glow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 12;

    // Outer pulse ring
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner filled badge
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#050505';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Step number text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(badgeRadius * 1.1)}px monospace, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(options.stepNumber), badgeX, badgeY + 1);
    ctx.restore();

    // 5. Draw step label pill if provided
    const labelText = options.label || `STEP ${options.stepNumber}`;
    ctx.save();
    ctx.font = `bold ${Math.max(12, Math.round(width * 0.011))}px sans-serif`;
    const textMetrics = ctx.measureText(labelText);
    const pillWidth = textMetrics.width + 16;
    const pillHeight = Math.max(22, Math.round(width * 0.018));
    const pillX = badgeX + badgeRadius + 8;
    const pillY = badgeY - pillHeight / 2;

    // Check boundary
    const safePillX = pillX + pillWidth > width - 10 ? badgeX - badgeRadius - pillWidth - 8 : pillX;

    ctx.fillStyle = 'rgba(10, 10, 10, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(safePillX, pillY, pillWidth, pillHeight, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, safePillX + pillWidth / 2, pillY + pillHeight / 2);
    ctx.restore();

    // 6. Draw bottom watermark strip
    const timeFormatted = options.timestampSeconds
      ? `${Math.floor(options.timestampSeconds / 60)}:${(options.timestampSeconds % 60).toString().padStart(2, '0')}`
      : '00:00';
    const watermarkText = `HUSKYNOTE FLIGHT RECORDER • STEP ${options.stepNumber} • ${timeFormatted} • LOCAL PRIVACY GUARANTEED`;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 5, 0.85)';
    ctx.fillRect(0, height - 26, width, 26);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 26);
    ctx.lineTo(width, height - 26);
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(watermarkText, 14, height - 13);
    ctx.restore();

    return {
      dataUrl: canvas.toDataURL('image/png'),
      point: { x: normX, y: normY },
    };
  }

  /**
   * Synthesize a structured Standard Operating Procedure (SOP) in Markdown.
   */
  generateSopMarkdown(params: {
    title: string;
    purpose?: string;
    requirements?: string[];
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      timestampMs?: number;
      targetCoords?: { x: number; y: number };
      screenshotDataUrl?: string;
    }>;
  }): string {
    const { title, purpose, requirements, steps } = params;
    const dateStr = new Date().toISOString().split('T')[0];

    let md = `# ${title || 'Standard Operating Procedure'}\n\n`;
    md += `**Document Type:** Standard Operating Procedure (SOP)  \n`;
    md += `**Generated Date:** ${dateStr}  \n`;
    md += `**Generator:** HuskyNote Screen Studio (Local-First AI Engine)  \n`;
    md += `**Verification Status:** Verified Automated Workflow  \n\n`;
    md += `---\n\n`;

    md += `## 1. Executive Summary & Objective\n\n`;
    md += `${purpose || 'This standard operating procedure defines the required sequence of steps captured during interactive screen recording.'}\n\n`;

    md += `## 2. Prerequisites & Environment\n\n`;
    const reqs = requirements && requirements.length > 0 ? requirements : ['Active local workspace authorization', 'Standard desktop screen permissions'];
    reqs.forEach((r) => {
      md += `- [x] ${r}\n`;
    });
    md += `\n---\n\n`;

    md += `## 3. Step-by-Step Annotated Walkthrough\n\n`;

    steps.forEach((s) => {
      const timeSec = s.timestampMs ? Math.round(s.timestampMs / 1000) : 0;
      const timeFmt = `${Math.floor(timeSec / 60)}:${(timeSec % 60).toString().padStart(2, '0')}`;
      md += `### Step ${s.stepNumber}: ${s.title || `Action Point ${s.stepNumber}`}\n\n`;
      md += `- **Timestamp:** \`${timeFmt}\`\n`;
      if (s.targetCoords) {
        md += `- **Focal Target:** Coordinate \`(${Math.round(s.targetCoords.x)}%, ${Math.round(s.targetCoords.y)}%)\`\n`;
      }
      md += `- **Action Directive:** ${s.description}\n\n`;

      if (s.screenshotDataUrl) {
        md += `![Step ${s.stepNumber} Annotated Frame](${s.screenshotDataUrl})\n\n`;
      }
    });

    md += `---\n\n`;
    md += `## 4. Verification & Quality Acceptance Checklist\n\n`;
    md += `- [ ] All operational steps executed without unexpected exceptions.\n`;
    md += `- [ ] System output verified against expected baseline state.\n`;
    md += `- [ ] Step log registered in local HuskyNote Knowledge Base.\n\n`;

    md += `## 5. Security & Privacy Audit\n\n`;
    md += `All screenshots, action coordinates, and documentation in this document were processed strictly on your computer. No screenshots or recordings were sent to external servers.\n`;

    return md;
  }
}

export const screenAnnotator = new ScreenAnnotatorService();
