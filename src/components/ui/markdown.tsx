/**
 * Exports: Markdown, MarkdownProps
 *
 * Markdown({ children: string, size?: 'sm' | 'base', className }): ReactMarkdown + remark-gfm inside Tailwind
 * Typography `prose` (base 16/28 for reading; sm for side panels). Prose colors follow the theme tokens, so no
 * dark:prose-invert is needed.
 * Safety: react-markdown never creates DOM from raw HTML (without rehype-raw, HTML in the source is rendered as
 * plain text), and every URL goes through react-markdown's defaultUrlTransform (http/https/mailto/relative only),
 * except that base64 raster `data:image/*` URLs are allowed on <img src> (SOP notes embed their screenshots that
 * way). Links stay restricted: a data: or javascript: URL in an href is removed.
 * The source is deliberately not passed through DOMPurify first: DOMPurify serializes HTML, so any note containing
 * "<" came back entity-escaped, which broke blockquotes and showed &lt; / &amp; inside code.
 */
import ReactMarkdown, { defaultUrlTransform, type UrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export interface MarkdownProps {
  children: string | null | undefined;
  size?: 'sm' | 'base';
  className?: string;
}

const remarkPlugins = [remarkGfm];

// Raster images only (no SVG, no data:text/html); base64 payload characters only.
const DATA_IMAGE_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i;

const urlTransform: UrlTransform = (url, key, node) =>
  key === 'src' && node.tagName === 'img' && DATA_IMAGE_URL.test(url) ? url : defaultUrlTransform(url);

function Markdown({ children, size = 'base', className }: MarkdownProps) {
  return (
    <div className={cn('prose max-w-none break-words', size === 'sm' && 'prose-sm', className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} urlTransform={urlTransform}>
        {children ?? ''}
      </ReactMarkdown>
    </div>
  );
}

export { Markdown };
