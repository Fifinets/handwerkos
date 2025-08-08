/**
 * Email encoding utilities for proper UTF-8 support
 * Handles German special characters and prevents encoding issues
 */

/**
 * Encode text to quoted-printable format for email MIME
 */
export function toQuotedPrintable(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/[^\x20-\x7E]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code <= 0xFF) {
        // Single byte character
        return `=${code.toString(16).toUpperCase().padStart(2, '0')}`;
      } else {
        // Multi-byte UTF-8 character
        const utf8Bytes = encodeURIComponent(char)
          .replace(/%/g, '')
          .match(/.{2}/g);
        return utf8Bytes ? utf8Bytes.map(byte => `=${byte}`).join('') : char;
      }
    })
    // Encode = character itself
    .replace(/=/g, (match, offset, string) => {
      // Don't encode = that's part of our encoding
      if (offset > 0 && string[offset - 1] === '=') return match;
      if (offset < string.length - 2 && /[0-9A-F]{2}/.test(string.substr(offset + 1, 2))) return match;
      return '=3D';
    })
    // Handle long lines (quoted-printable max line length is 76)
    .replace(/(.{75})/g, '$1=\r\n');
}

/**
 * Encode email subject with RFC 2047 encoding for special characters
 */
export function encodeEmailSubject(subject: string): string {
  if (!subject) return '';
  
  // Check if subject contains non-ASCII characters
  if (!/[^\x00-\x7F]/.test(subject)) {
    return subject; // No encoding needed
  }
  
  // RFC 2047 encoding: =?charset?encoding?encoded-text?=
  const utf8Bytes = new TextEncoder().encode(subject);
  const base64Encoded = btoa(String.fromCharCode(...utf8Bytes));
  
  return `=?UTF-8?B?${base64Encoded}?=`;
}

/**
 * Create proper MIME headers for multipart email
 */
export function createMimeHeaders(options: {
  to: string;
  subject: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const { to, subject, messageId, inReplyTo, references } = options;
  
  const headers = [
    `To: ${to}`,
    `Subject: ${encodeEmailSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; charset=utf-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  
  if (messageId) {
    headers.push(`Message-ID: ${messageId}`);
  }
  
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  
  if (references) {
    headers.push(`References: ${references}`);
  }
  
  return headers.join('\r\n');
}

/**
 * Create multipart email with proper UTF-8 encoding
 */
export function createMultipartEmail(options: {
  to: string;
  subject: string;
  htmlContent: string;
  plainTextContent: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const { htmlContent, plainTextContent, ...headerOptions } = options;
  
  // Generate unique boundary
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // Create headers
  const headers = createMimeHeaders({
    ...headerOptions,
  }).replace(
    'Content-Type: multipart/alternative; charset=utf-8',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  );
  
  // Clean content for proper UTF-8 encoding
  const cleanHtmlContent = cleanContentForUtf8(htmlContent);
  const cleanPlainTextContent = cleanContentForUtf8(plainTextContent);
  
  const email = [
    headers,
    '',
    `This is a multi-part message in MIME format.`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    cleanPlainTextContent,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    cleanHtmlContent,
    '',
    `--${boundary}--`
  ].join('\r\n');
  
  return email;
}

/**
 * Clean content and ensure proper UTF-8 encoding
 */
export function cleanContentForUtf8(content: string): string {
  if (!content) return '';
  
  return content
    // Fix common encoding issues first
    .replace(/â‚¬/g, '€')     // Euro symbol
    .replace(/Ã¤/g, 'ä')      // ä
    .replace(/Ã¶/g, 'ö')      // ö
    .replace(/Ã¼/g, 'ü')      // ü
    .replace(/Ã„/g, 'Ä')      // Ä
    .replace(/Ã–/g, 'Ö')      // Ö
    .replace(/Ãœ/g, 'Ü')      // Ü
    .replace(/ÃŸ/g, 'ß')      // ß
    
    // Fix smart quotes and dashes
    .replace(/â€™/g, "'")     // Right single quotation mark
    .replace(/â€œ/g, '"')     // Left double quotation mark  
    .replace(/â€/g, '"')      // Right double quotation mark
    .replace(/â€"/g, '—')     // Em dash
    .replace(/â€"/g, '–')     // En dash
    
    // Remove broken decorative characters
    .replace(/âÍ/g, '')       // Remove broken decorative chars
    .replace(/Â­/g, '')       // Remove soft hyphens
    .replace(/Â /g, ' ')      // Fix non-breaking spaces
    .replace(/Â/g, '')        // Remove stray artifacts
    
    // Normalize line endings
    .replace(/\r\n|\r|\n/g, '\n')
    
    // Clean up excessive whitespace
    .replace(/\s{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Test function to validate UTF-8 encoding
 */
export function testUtf8Encoding(): void {
  const testStrings = [
    'Hallo Welt! äöüß €',
    'Test with "smart quotes" and —dashes—',
    'Émojis 🚀 and special chars ñáéíóú',
    'âÍâÍâÍ broken sequence Â­Â­Â­'
  ];
  
  console.log('UTF-8 Encoding Tests:');
  
  testStrings.forEach((test, index) => {
    const cleaned = cleanContentForUtf8(test);
    const encoded = encodeEmailSubject(test);
    const quotedPrintable = toQuotedPrintable(test);
    
    console.log(`Test ${index + 1}:`);
    console.log(`  Original: ${test}`);
    console.log(`  Cleaned:  ${cleaned}`);
    console.log(`  Subject:  ${encoded}`);
    console.log(`  QP:       ${quotedPrintable}`);
    console.log('');
  });
}

/**
 * Validate email content for common encoding issues
 */
export function validateEmailContent(content: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  if (!content) {
    return { isValid: true, issues: [], suggestions: [] };
  }

  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check for broken UTF-8 sequences (more comprehensive)
  const brokenUtf8Patterns = [
    /âÍ/g,           // Broken decorative characters
    /Â­/g,           // Broken soft hyphens  
    /Â /g,           // Broken non-breaking spaces
    /Ã[¤¶¼„–œŸ]/g,  // Double-encoded German characters
    /â€[™œ"]/g,      // Broken smart quotes
    /â€[""]/g,       // Broken dashes
    /Â(?![A-Za-z])/g // Stray UTF-8 artifacts
  ];
  
  let hasBrokenUtf8 = false;
  for (const pattern of brokenUtf8Patterns) {
    if (pattern.test(content)) {
      hasBrokenUtf8 = true;
      break;
    }
  }
  
  if (hasBrokenUtf8) {
    issues.push('Broken UTF-8 sequences detected');
    suggestions.push('Content will be automatically cleaned during display');
  }
  
  // Check for smart quotes that might cause issues (but don't flag as critical)
  if (/[""'']/g.test(content)) {
    // Only add as suggestion, not as issue
    suggestions.push('Smart quotes found - will be normalized for better compatibility');
  }
  
  // Check for emojis (informational only)
  if (/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu.test(content)) {
    suggestions.push('Emojis detected - may not display in all email clients');
  }
  
  // Check for very long lines (informational, will be auto-fixed)
  const lines = content.split('\n');
  const longLines = lines.filter(line => line.length > 78);
  if (longLines.length > 0) {
    issues.push(`${longLines.length} lines longer than 78 characters`);
    suggestions.push('Long lines will be automatically wrapped for better email formatting');
  }
  
  // Check for suspicious HTML patterns that might not render well
  if (/<style\s*>/i.test(content)) {
    issues.push('External CSS styles detected');
    suggestions.push('Email clients may ignore <style> tags - inline styles recommended');
  }
  
  if (/<script\s*>/i.test(content)) {
    issues.push('JavaScript detected');
    suggestions.push('JavaScript will be removed for security - use static content only');
  }
  
  // Check for relative URLs
  if (/(?:src|href)\s*=\s*["'][^"']*(?:^(?!https?:\/\/|mailto:|tel:))[^"']*["']/i.test(content)) {
    issues.push('Relative URLs detected');
    suggestions.push('Use absolute URLs for better email client compatibility');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

/**
 * Auto-fix common email content issues
 */
export function autoFixEmailContent(content: string): {
  fixedContent: string;
  appliedFixes: string[];
} {
  if (!content) {
    return { fixedContent: '', appliedFixes: [] };
  }

  const appliedFixes: string[] = [];
  let fixedContent = content;
  
  // Fix broken UTF-8 sequences
  const originalLength = fixedContent.length;
  fixedContent = cleanContentForUtf8(fixedContent);
  if (fixedContent.length !== originalLength || 
      !/[âÍÂ­Â]/.test(fixedContent)) {
    appliedFixes.push('Fixed broken UTF-8 encoding sequences');
  }
  
  // Break long lines
  const lines = fixedContent.split('\n');
  const longLinesCount = lines.filter(line => line.length > 78).length;
  if (longLinesCount > 0) {
    fixedContent = breakLongLines(fixedContent);
    appliedFixes.push(`Wrapped ${longLinesCount} long lines for better formatting`);
  }
  
  // Remove dangerous HTML elements
  const originalHtml = fixedContent;
  fixedContent = fixedContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '');
    
  if (originalHtml !== fixedContent) {
    appliedFixes.push('Removed potentially unsafe HTML elements');
  }
  
  // Normalize whitespace
  const beforeWhitespace = fixedContent;
  fixedContent = fixedContent
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
    
  if (beforeWhitespace !== fixedContent) {
    appliedFixes.push('Normalized whitespace and line breaks');
  }
  
  return { fixedContent, appliedFixes };
}

/**
 * Break long lines in content while preserving structure
 */
function breakLongLines(content: string, maxLength: number = 78): string {
  const lines = content.split('\n');
  const brokenLines: string[] = [];
  
  for (const line of lines) {
    if (line.length <= maxLength) {
      brokenLines.push(line);
    } else {
      // Check if line is HTML tag or contains HTML
      if (/<[^>]+>/.test(line)) {
        // For HTML lines, be more careful about breaking
        brokenLines.push(line); // Keep HTML lines intact for now
      } else {
        // Break plain text lines at word boundaries
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          if (currentLine.length + word.length + 1 <= maxLength) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) {
              brokenLines.push(currentLine);
            }
            currentLine = word;
          }
        }
        
        if (currentLine) {
          brokenLines.push(currentLine);
        }
      }
    }
  }
  
  return brokenLines.join('\n');
}