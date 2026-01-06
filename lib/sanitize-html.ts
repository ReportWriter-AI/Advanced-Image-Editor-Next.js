/**
 * Sanitizes HTML content using DOMPurify (client) or sanitize-html (server)
 * Works in both client-side and server-side contexts
 */

let DOMPurifyInstance: any = null;

/**
 * Sanitizes HTML content, allowing safe formatting tags used by TinyMCE
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) {
    return '';
  }

  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Client-side: use DOMPurify
    if (!DOMPurifyInstance) {
      try {
        DOMPurifyInstance = require('dompurify');
      } catch (e) {
        // Fallback to basic escaping if DOMPurify is not available
        return html
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    }

    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'code', 'sub', 'sup', 'strike', 's',
        'a', 'img', 'video', 'audio', 'source', 'iframe'
      ],
      ALLOWED_ATTR: [
        'style', 'class', 'color', 'face', 'size',
        'align', 'dir', 'lang', 'title',
        'href', 'target', 'rel', 'name', 'id',
        'src', 'alt', 'width', 'height', 'loading',
        'controls', 'autoplay', 'loop', 'muted', 'poster',
        'frameborder', 'allowfullscreen', 'allow', 'sandbox'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM: false,
      RETURN_TRUSTED_TYPE: false,
    };

    return DOMPurifyInstance.sanitize(html, config);
  } else {
    // Server-side: use sanitize-html (no jsdom dependency)
    try {
      const sanitizeHtmlLib = require('sanitize-html');
      
      return sanitizeHtmlLib(html, {
        allowedTags: [
          'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
          'blockquote', 'pre', 'code', 'sub', 'sup', 'strike', 's',
          'a', 'img', 'video', 'audio', 'source', 'iframe'
        ],
        allowedAttributes: {
          '*': ['style', 'class', 'color', 'face', 'size', 'align', 'dir', 'lang', 'title'],
          'a': ['href', 'target', 'rel', 'name', 'id'],
          'img': ['src', 'alt', 'width', 'height', 'loading', 'style', 'class'],
          'video': ['src', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'poster', 'style', 'class'],
          'audio': ['src', 'controls', 'autoplay', 'loop', 'muted', 'style', 'class'],
          'source': ['src', 'type'],
          'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'sandbox', 'style', 'class']
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data', 'blob'],
        allowedSchemesByTag: {
          'img': ['http', 'https', 'data'],
          'video': ['http', 'https', 'data', 'blob'],
          'audio': ['http', 'https', 'data', 'blob'],
          'source': ['http', 'https', 'data', 'blob'],
          'iframe': ['http', 'https']
        },
        allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
        allowProtocolRelative: false,
      });
    } catch (e) {
      // Fallback to basic HTML escaping if sanitize-html is not available
      return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }
}

