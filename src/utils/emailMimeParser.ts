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
 * Parse email content and extract HTML/text parts with preprocessing
 */
export function parseEmailContent(rawContent: string): ParsedEmailContent {
  // Preprocess content to fix common issues
  const preprocessedContent = preprocessEmailContent(rawContent);
  const headers = parseEmailHeaders(preprocessedContent);
  
  let result: ParsedEmailContent;
  
  if (headers.multipart && headers.boundary) {
    result = parseMultipartEmail(preprocessedContent, headers);
  } else {
    result = parseSinglePartEmail(preprocessedContent, headers);
  }
  
  // Post-process all content parts
  return postProcessParsedContent(result);
}

/**
 * Preprocess email content to fix common issues before parsing
 */
function preprocessEmailContent(content: string): string {
  if (!content) return '';
  
  return content
    // Fix line ending issues
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    
    // Fix common encoding issues early
    .replace(/â‚¬/g, '€')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    
    // Remove broken decorative sequences
    .replace(/âÍ+/g, '')
    .replace(/Â­+/g, '')
    .replace(/Â +/g, ' ')
    .replace(/Â/g, '')
    
    // Fix smart quotes and dashes
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€"/g, '—')
    .replace(/â€"/g, '–')
    
    // Clean up excessive whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Post-process parsed content to ensure quality
 */
function postProcessParsedContent(parsed: ParsedEmailContent): ParsedEmailContent {
  // Clean and format HTML content
  if (parsed.htmlContent) {
    parsed.htmlContent = cleanAndFormatContent(parsed.htmlContent);
  }
  
  // Clean and format plain text content
  if (parsed.plainTextContent) {
    parsed.plainTextContent = cleanAndFormatContent(parsed.plainTextContent);
  }
  
  // Update preferred content
  if (parsed.htmlContent && shouldPreferHtml(parsed.htmlContent)) {
    parsed.preferredContent = parsed.htmlContent;
    parsed.contentType = 'html';
  } else if (parsed.plainTextContent) {
    parsed.preferredContent = parsed.plainTextContent;
    parsed.contentType = 'text';
  } else {
    parsed.preferredContent = cleanAndFormatContent(parsed.preferredContent);
  }
  
  return parsed;
}

/**
 * Clean and format content with line breaking and encoding fixes
 */
function cleanAndFormatContent(content: string): string {
  if (!content) return '';
  
  let cleaned = content
    // Final encoding cleanup
    .replace(/â‚¬/g, '€').replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä').replace(/Ã–/g, 'Ö').replace(/Ãœ/g, 'Ü').replace(/ÃŸ/g, 'ß')
    .replace(/â€™/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"')
    .replace(/â€"/g, '—').replace(/â€"/g, '–')
    .replace(/âÍ+/g, '').replace(/Â­+/g, '').replace(/Â +/g, ' ').replace(/Â/g, '')
    
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  
  // Break long lines for better email formatting
  cleaned = breakLongLines(cleaned);
  
  return cleaned.trim();
}

/**
 * Break long lines for better email client compatibility
 */
function breakLongLines(content: string, maxLength: number = 78): string {
  if (!content) return '';
  
  // Check if content is HTML (don't break HTML tags)
  const isHTML = /<[a-z][\s\S]*>/i.test(content);
  
  if (isHTML) {
    return breakHtmlLines(content, maxLength);
  } else {
    return breakPlainTextLines(content, maxLength);
  }
}

/**
 * Break long lines in plain text content
 */
function breakPlainTextLines(content: string, maxLength: number): string {
  const lines = content.split('\n');
  const brokenLines: string[] = [];
  
  for (const line of lines) {
    if (line.length <= maxLength) {
      brokenLines.push(line);
    } else {
      // Break long lines at word boundaries
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxLength) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) {
            brokenLines.push(currentLine);
          }
          
          // Handle very long words
          if (word.length > maxLength) {
            // Break at URL boundaries or hyphens
            const brokenWord = breakLongWord(word, maxLength);
            brokenLines.push(...brokenWord);
            currentLine = '';
          } else {
            currentLine = word;
          }
        }
      }
      
      if (currentLine) {
        brokenLines.push(currentLine);
      }
    }
  }
  
  return brokenLines.join('\n');
}

/**
 * Break long lines in HTML content more carefully
 */
function breakHtmlLines(content: string, maxLength: number): string {
  // For HTML, we only break very long text nodes, not the HTML structure
  return content.replace(/>[^<]{78,}</g, (match) => {
    const textContent = match.substring(1);
    const brokenText = breakPlainTextLines(textContent, maxLength);
    return '>' + brokenText;
  });
}

/**
 * Break very long words (like URLs) at appropriate points
 */
function breakLongWord(word: string, maxLength: number): string[] {
  if (word.length <= maxLength) return [word];
  
  const result: string[] = [];
  let remaining = word;
  
  while (remaining.length > maxLength) {
    // Try to break at natural points
    let breakPoint = maxLength;
    
    // Look for good break points (slashes, hyphens, dots)
    for (let i = maxLength - 10; i < maxLength; i++) {
      if ('/-.?&='.includes(remaining[i])) {
        breakPoint = i + 1;
        break;
      }
    }
    
    result.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint);
  }
  
  if (remaining) {
    result.push(remaining);
  }
  
  return result;
}

/**
 * Determine if HTML content should be preferred over plain text
 */
function shouldPreferHtml(htmlContent: string): boolean {
  if (!htmlContent) return false;
  
  // Count meaningful HTML elements (not just line breaks)
  const meaningfulHtmlTags = (htmlContent.match(/<(?!br\s*\/?>)[a-z][^>]*>/gi) || []).length;
  
  // Prefer HTML if it has meaningful formatting
  return meaningfulHtmlTags > 2;
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
  
  // Enhanced HTML detection
  const isHtml = headers.contentType.includes('text/html') || 
                 /<[a-z][\s\S]*>/i.test(decodedContent) ||
                 /<html/i.test(decodedContent) ||
                 /<body/i.test(decodedContent) ||
                 /<div/i.test(decodedContent) ||
                 /<p>/i.test(decodedContent) ||
                 /<br/i.test(decodedContent);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Single part parsing:', {
      contentType: headers.contentType,
      hasHtmlTags: /<[a-z][\s\S]*>/i.test(decodedContent),
      isHtml,
      contentPreview: decodedContent.substring(0, 200)
    });
  }
  
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
 * Sanitize HTML content for safe display while preserving email styling
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html) return '';
  
  // Minimal sanitization - only remove dangerous elements, keep styling
  let sanitized = html
    // Remove potentially dangerous elements
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<applet[^>]*>[\s\S]*?<\/applet>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    
    // Keep <style> tags for email styling - they are needed!
    // Only remove problematic CSS, not all styles
    
    // Remove only specific problematic meta tags, keep others
    .replace(/<meta[^>]*http-equiv[^>]*>/gi, '')
    
    // Clean up excessive outlook-specific comments but keep some structure
    .replace(/<!--\[if !mso\]>[\s\S]*?<!\[endif\]-->/gi, '')
    
    // Keep most HTML structure but ensure it's contained
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '<div class="email-html-wrapper">')
    .replace(/<\/html>/gi, '</div>')
    .replace(/<head[^>]*>/gi, '<div class="email-head-wrapper" style="display: none;">')
    .replace(/<\/head>/gi, '</div>')
    .replace(/<body([^>]*)>/gi, '<div class="email-body-wrapper"$1>')
    .replace(/<\/body>/gi, '</div>')
    
    // Fix relative URLs to absolute ones if possible
    .replace(/src="\/\//g, 'src="https://')
    .replace(/href="\/\//g, 'href="https://')
    
    // Fix common encoding issues in HTML attributes
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    
    // Clean up excessive whitespace but preserve structure
    .replace(/>\s+</g, '><')
    .trim();
  
  // Apply email-specific fixes without destroying structure
  sanitized = fixEmailLayout(sanitized);
  
  return sanitized;
}

/**
 * Fix email layout without destroying structure
 */
function fixEmailLayout(html: string): string {
  if (!html) return '';
  
  // Apply minimal fixes to improve display without breaking email structure
  let fixed = html
    // Fix common image issues
    .replace(/<img([^>]*?)>/gi, (match, attrs) => {
      // Don't modify if already has good sizing
      if (attrs.includes('max-width') || attrs.includes('width: 100%')) {
        return match;
      }
      
      // Add responsive styling to images
      const styleToAdd = ' style="max-width: 100%; height: auto;"';
      if (attrs.includes('style=')) {
        return match.replace(/style="([^"]*)"/, 'style="$1; max-width: 100%; height: auto;"');
      } else {
        return `<img${attrs}${styleToAdd}>`;
      }
    })
    
    // Fix table layouts for better responsive behavior
    .replace(/<table([^>]*?)>/gi, (match, attrs) => {
      // Add responsive table styling if not present
      if (!attrs.includes('style=') || !attrs.includes('width')) {
        const styleToAdd = ' style="width: 100%; max-width: 100%;"';
        if (attrs.includes('style=')) {
          return match.replace(/style="([^"]*)"/, 'style="$1; width: 100%; max-width: 100%;"');
        } else {
          return `<table${attrs}${styleToAdd}>`;
        }
      }
      return match;
    })
    
    // Improve link accessibility
    .replace(/<a([^>]*?)>/gi, (match, attrs) => {
      if (!attrs.includes('target=')) {
        return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
      }
      return match;
    })
    
    // Clean up only problematic MSO styles, not all styles
    .replace(/mso-[^:]*:[^;]*;?/gi, '')
    
    // Fix font declarations
    .replace(/font-family:\s*[^,;]*mso[^;]*;?/gi, 'font-family: Arial, sans-serif;')
    
    // Remove empty style attributes
    .replace(/\s*style="[\s;]*"/gi, '')
    
    // Clean up excessive spaces in attributes
    .replace(/\s+([a-z-]+)="/gi, ' $1="');
  
  return fixed;
}

/**
 * Check if content should be displayed as HTML
 */
export function shouldDisplayAsHtml(parsedContent: ParsedEmailContent): boolean {
  const preference = getPreferredContentType();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 shouldDisplayAsHtml check:', {
      preference,
      hasHtmlContent: !!parsedContent.htmlContent,
      contentType: parsedContent.contentType,
      htmlPreview: parsedContent.htmlContent?.substring(0, 100)
    });
  }
  
  // If user prefers text, always show text
  if (preference === 'text') {
    return false;
  }
  
  // If HTML content is available, prefer it
  if (parsedContent.htmlContent) {
    return true;
  }
  
  // Check if content type is HTML
  if (parsedContent.contentType === 'html') {
    return true;
  }
  
  // Fallback to detecting HTML in content
  const hasHtml = parsedContent.preferredContent && (
    /<[a-z][\s\S]*>/i.test(parsedContent.preferredContent) ||
    /<html/i.test(parsedContent.preferredContent) ||
    /<body/i.test(parsedContent.preferredContent) ||
    /<div/i.test(parsedContent.preferredContent)
  );
  
  return hasHtml || false;
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