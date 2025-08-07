/**
 * MIME email parser for proper email content extraction and display
 * Handles multipart emails, HTML/text detection, and content-type parsing
 */

export interface ParsedEmailContent {
  htmlContent: string | null;
  plainTextContent: string | null;
  preferredContent: string;
  contentType: 'html' | 'text';
  hasAttachments: boolean;
  attachments: EmailAttachment[];
  headers: EmailHeaders;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  inline: boolean;
}

export interface EmailHeaders {
  contentType: string;
  charset: string;
  contentTransferEncoding: string;
  multipart: boolean;
  boundary?: string;
}

/**
 * Parse email content and extract HTML/text parts
 */
export function parseEmailContent(rawContent: string): ParsedEmailContent {
  const headers = parseEmailHeaders(rawContent);
  
  if (headers.multipart && headers.boundary) {
    return parseMultipartEmail(rawContent, headers);
  } else {
    return parseSinglePartEmail(rawContent, headers);
  }
}

/**
 * Parse email headers to determine content structure
 */
function parseEmailHeaders(content: string): EmailHeaders {
  const headerMatch = content.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/);
  const headerSection = headerMatch ? headerMatch[1] : content;
  
  // Parse Content-Type header
  const contentTypeMatch = headerSection.match(/Content-Type:\s*([^;\r\n]+)(?:;\s*([^\r\n]+))?/i);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'text/plain';
  
  // Parse charset
  const charsetMatch = headerSection.match(/charset=([^;\s\r\n]+)/i);
  const charset = charsetMatch ? charsetMatch[1].replace(/['"]/g, '') : 'utf-8';
  
  // Parse Content-Transfer-Encoding
  const encodingMatch = headerSection.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
  const contentTransferEncoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '8bit';
  
  // Check for multipart
  const isMultipart = contentType.startsWith('multipart/');
  let boundary: string | undefined;
  
  if (isMultipart) {
    const boundaryMatch = headerSection.match(/boundary=([^;\s\r\n]+)/i);
    boundary = boundaryMatch ? boundaryMatch[1].replace(/['"]/g, '') : undefined;
  }
  
  return {
    contentType,
    charset,
    contentTransferEncoding,
    multipart: isMultipart,
    boundary
  };
}

/**
 * Parse multipart email and extract HTML/text parts
 */
function parseMultipartEmail(content: string, headers: EmailHeaders): ParsedEmailContent {
  if (!headers.boundary) {
    return createEmptyParsedContent(headers);
  }
  
  // Split content by boundary
  const parts = content.split(new RegExp(`--${escapeRegExp(headers.boundary)}`, 'g'));
  
  let htmlContent: string | null = null;
  let plainTextContent: string | null = null;
  const attachments: EmailAttachment[] = [];
  
  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;
    
    const partHeaders = parsePartHeaders(part);
    const partContent = extractPartContent(part);
    
    if (!partContent) continue;
    
    // Determine part type
    if (partHeaders.contentType.includes('text/html')) {
      htmlContent = decodePartContent(partContent, partHeaders.contentTransferEncoding);
    } else if (partHeaders.contentType.includes('text/plain')) {
      plainTextContent = decodePartContent(partContent, partHeaders.contentTransferEncoding);
    } else if (partHeaders.disposition?.includes('attachment') || partHeaders.filename) {
      // Handle attachment
      attachments.push({
        filename: partHeaders.filename || 'unknown',
        contentType: partHeaders.contentType,
        size: partContent.length,
        contentId: partHeaders.contentId,
        inline: partHeaders.disposition?.includes('inline') || false
      });
    }
  }
  
  return {
    htmlContent,
    plainTextContent,
    preferredContent: htmlContent || plainTextContent || '',
    contentType: htmlContent ? 'html' : 'text',
    hasAttachments: attachments.length > 0,
    attachments,
    headers
  };
}

/**
 * Parse single part email
 */
function parseSinglePartEmail(content: string, headers: EmailHeaders): ParsedEmailContent {
  const contentPart = extractContentFromSinglePart(content);
  const decodedContent = decodePartContent(contentPart, headers.contentTransferEncoding);
  
  const isHtml = headers.contentType.includes('text/html') || 
                 /<[a-z][\s\S]*>/i.test(decodedContent);
  
  return {
    htmlContent: isHtml ? decodedContent : null,
    plainTextContent: isHtml ? null : decodedContent,
    preferredContent: decodedContent,
    contentType: isHtml ? 'html' : 'text',
    hasAttachments: false,
    attachments: [],
    headers
  };
}

/**
 * Parse part headers within multipart content
 */
function parsePartHeaders(part: string): {
  contentType: string;
  contentTransferEncoding: string;
  disposition?: string;
  filename?: string;
  contentId?: string;
} {
  const headerMatch = part.match(/^([\s\S]*?)\r?\n\r?\n/);
  const headerSection = headerMatch ? headerMatch[1] : '';
  
  // Parse Content-Type
  const contentTypeMatch = headerSection.match(/Content-Type:\s*([^;\r\n]+)/i);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'text/plain';
  
  // Parse Content-Transfer-Encoding
  const encodingMatch = headerSection.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
  const contentTransferEncoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '8bit';
  
  // Parse Content-Disposition
  const dispositionMatch = headerSection.match(/Content-Disposition:\s*([^\r\n]+)/i);
  const disposition = dispositionMatch ? dispositionMatch[1].trim().toLowerCase() : undefined;
  
  // Parse filename
  const filenameMatch = headerSection.match(/filename=([^;\r\n]+)/i);
  const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, '').trim() : undefined;
  
  // Parse Content-ID
  const contentIdMatch = headerSection.match(/Content-ID:\s*([^\r\n]+)/i);
  const contentId = contentIdMatch ? contentIdMatch[1].replace(/[<>]/g, '').trim() : undefined;
  
  return {
    contentType,
    contentTransferEncoding,
    disposition,
    filename,
    contentId
  };
}

/**
 * Extract content from email part
 */
function extractPartContent(part: string): string {
  const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)$/);
  return contentMatch ? contentMatch[1] : part;
}

/**
 * Extract content from single part email
 */
function extractContentFromSinglePart(content: string): string {
  // Find double line break that separates headers from content
  const contentMatch = content.match(/^[\s\S]*?\r?\n\r?\n([\s\S]*)$/);
  return contentMatch ? contentMatch[1] : content;
}

/**
 * Decode part content based on encoding
 */
function decodePartContent(content: string, encoding: string): string {
  if (!content) return '';
  
  try {
    switch (encoding.toLowerCase()) {
      case 'base64':
        return atob(content.replace(/\s/g, ''));
      
      case 'quoted-printable':
        return decodeQuotedPrintable(content);
      
      case '8bit':
      case '7bit':
      case 'binary':
      default:
        return content;
    }
  } catch (error) {
    console.warn('Failed to decode email content:', error);
    return content;
  }
}

/**
 * Decode quoted-printable content
 */
function decodeQuotedPrintable(content: string): string {
  return content
    // Remove soft line breaks
    .replace(/=\r?\n/g, '')
    // Decode =XX sequences
    .replace(/=([0-9A-F]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

/**
 * Create empty parsed content structure
 */
function createEmptyParsedContent(headers: EmailHeaders): ParsedEmailContent {
  return {
    htmlContent: null,
    plainTextContent: null,
    preferredContent: '',
    contentType: 'text',
    hasAttachments: false,
    attachments: [],
    headers
  };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Determine if client prefers HTML or plain text display
 */
export function getPreferredContentType(): 'html' | 'text' {
  // Check if HTML rendering is available (in browser context)
  if (typeof window !== 'undefined' && window.document) {
    return 'html';
  }
  
  // Check for user preference in localStorage
  if (typeof localStorage !== 'undefined') {
    const preference = localStorage.getItem('emailDisplayPreference');
    if (preference === 'text' || preference === 'html') {
      return preference as 'html' | 'text';
    }
  }
  
  // Default to HTML if available
  return 'html';
}

/**
 * Sanitize HTML content for safe display
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html) return '';
  
  // Basic HTML sanitization - remove potentially dangerous elements
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<applet[^>]*>[\s\S]*?<\/applet>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Check if content should be displayed as HTML
 */
export function shouldDisplayAsHtml(parsedContent: ParsedEmailContent): boolean {
  const preference = getPreferredContentType();
  
  // If user prefers text, always show text
  if (preference === 'text') {
    return false;
  }
  
  // If HTML content is available and preference is HTML, show HTML
  if (parsedContent.htmlContent && preference === 'html') {
    return true;
  }
  
  // Fallback to detecting HTML in content
  if (parsedContent.preferredContent && /<[a-z][\s\S]*>/i.test(parsedContent.preferredContent)) {
    return true;
  }
  
  return false;
}

/**
 * Test the MIME parser with sample content
 */
export function testMimeParser(): void {
  const testMultipart = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

Plain text content with äöüß

--boundary123
Content-Type: text/html; charset=utf-8

<html><body><h1>HTML content with äöüß</h1></body></html>

--boundary123--`;

  const parsed = parseEmailContent(testMultipart);
  console.log('MIME Parser Test:', {
    htmlContent: parsed.htmlContent,
    plainTextContent: parsed.plainTextContent,
    contentType: parsed.contentType,
    preferredContent: parsed.preferredContent.substring(0, 100)
  });
}