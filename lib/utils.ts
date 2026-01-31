import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Splits a comma-separated string and trims whitespace from each item
 * @param text - The comma-separated string to split
 * @returns Array of trimmed strings, filtered to remove empty values
 */
export function splitCommaSeparated(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return []
  }
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Extracts plain text from HTML content, replacing media elements with placeholders
 * Works client-side only (uses DOM APIs)
 * @param html - HTML string to extract text from
 * @returns Plain text string with media placeholders
 */
export function extractPlainTextFromHtml(html: string | undefined | null): string {
  if (!html) return '';
  
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    // Server-side fallback: basic regex-based extraction
    return html
      .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '[Image: $1]')
      .replace(/<img[^>]*>/gi, '[Image]')
      .replace(/<video[^>]*>/gi, '[Video]')
      .replace(/<audio[^>]*>/gi, '[Audio]')
      .replace(/<iframe[^>]*>/gi, '[Embedded Content]')
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Client-side: use DOM for accurate extraction
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Replace media elements with placeholder text
  tempDiv.querySelectorAll('img').forEach(img => {
    const alt = img.getAttribute('alt') || '';
    const placeholder = alt ? `[Image: ${alt}]` : '[Image]';
    img.replaceWith(document.createTextNode(placeholder));
  });
  
  tempDiv.querySelectorAll('video').forEach(video => {
    video.replaceWith(document.createTextNode('[Video]'));
  });
  
  tempDiv.querySelectorAll('audio').forEach(audio => {
    audio.replaceWith(document.createTextNode('[Audio]'));
  });
  
  tempDiv.querySelectorAll('iframe').forEach(iframe => {
    iframe.replaceWith(document.createTextNode('[Embedded Content]'));
  });
  
  // Get text content
  let text = tempDiv.textContent || tempDiv.innerText || '';
  
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  text = textarea.value;
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Truncates text to a specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 150)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

/**
 * Strips HTML tags and decodes entities to produce plain text.
 * Works in both client and server environments.
 * Use for truncation previews or search indexing of rich text.
 */
export function stripHtmlToText(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}