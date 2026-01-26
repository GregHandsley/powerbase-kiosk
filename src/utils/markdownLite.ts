/**
 * Simple markdown-lite renderer for announcements
 * Supports: **bold**, *italic*, `code`, and line breaks
 */

export function renderMarkdownLite(text: string): string {
  let html = text;

  // Escape HTML first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert line breaks to <br>
  html = html.replace(/\n/g, '<br>');

  // Inline code: `code` (process before bold/italic to avoid conflicts)
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-300">$1</code>'
  );

  // Bold: **text** or __text__ (process before italic)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (but not if it's part of **text** or __text__)
  // Use a simpler approach: match single * or _ that aren't doubled
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');

  return html;
}
