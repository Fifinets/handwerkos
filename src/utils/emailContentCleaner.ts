/**
 * Advanced email content cleaning utility
 * Handles various encoding issues and visual formatting problems
 */

export interface EmailCleaningOptions {
  removeDecorations?: boolean;
  fixImages?: boolean;
  preserveFormatting?: boolean;
  addPhoneLinks?: boolean;
  maxLineLength?: number;
}

/**
 * Comprehensive email content cleaner
 */
export function cleanEmailContent(content: string, options: EmailCleaningOptions = {}): string {
  if (!content) return '';

  const {
    removeDecorations = true,
    fixImages = true,
    preserveFormatting = true,
    addPhoneLinks = true,
    maxLineLength = 78
  } = options;

  let cleanedContent = content;

  // Step 0: Preprocess email content (handles complex cases like Airbnb)
  cleanedContent = preprocessEmailContent(cleanedContent);

  // Step 1: Fix UTF-8 encoding issues
  cleanedContent = fixUTF8Encoding(cleanedContent);

  // Step 2: Remove broken visual elements
  if (removeDecorations) {
    cleanedContent = removeVisualNoise(cleanedContent);
  }

  // Step 3: Fix HTML-specific issues
  const isHTML = /<[a-z][\s\S]*>/i.test(cleanedContent);
  if (isHTML) {
    cleanedContent = fixHTMLContent(cleanedContent, { fixImages, preserveFormatting });
  } else {
    cleanedContent = formatPlainTextContent(cleanedContent, { addPhoneLinks, maxLineLength });
  }

  // Step 4: Final cleanup
  cleanedContent = finalCleanup(cleanedContent);

  return cleanedContent;
}

/**
 * Preprocess email content to handle complex cases
 */
function preprocessEmailContent(content: string): string {
  let processed = content;

  // Handle long lines by adding breaks at natural points
  processed = processed.replace(/(.{78,}?)(\s|$)/g, (match, line, ending) => {
    if (line.includes('http') && !line.includes(' ')) {
      // Don't break URLs
      return match;
    }
    return line + '\n' + ending;
  });

  // Fix broken character sequences that appear in Airbnb/other service emails
  processed = processed
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö') 
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Ã/g, 'Ü') // Common encoding error for 'Ü'
    .replace(/FÃR/g, 'FÜR')
    .replace(/SCHREIBENB/g, 'SCHREIBEN\nB');

  // Handle URLs that are split across lines or have encoding issues
  processed = processed.replace(/https?:\/\/[^\s]+/g, (url) => {
    return url.replace(/\s/g, '').replace(/=+$/, '');
  });

  // Fix common email formatting issues - split rating options properly
  processed = processed.replace(/]([A-Z][a-z]+)\[/g, ']\n\n$1\n[');

  // Handle email signatures and footers better
  processed = processed.replace(/(Airbnb Ireland UC8.*?Ireland)/, '\n\n---\n$1');

  // Clean up excessive whitespace but preserve intentional breaks
  processed = processed.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

  return processed;
}

/**
 * Fix common UTF-8 encoding problems
 */
function fixUTF8Encoding(content: string): string {
  return content
    // Euro symbol variations
    .replace(/â‚¬/g, '€')
    .replace(/&euro;/g, '€')
    
    // German umlauts - double encoding fixes
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    
    // HTML entity versions
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    
    // Quotation marks
    .replace(/â€™/g, "'")    // Right single quotation
    .replace(/â€œ/g, '"')    // Left double quotation
    .replace(/â€/g, '"')     // Right double quotation
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    
    // Dashes and hyphens
    .replace(/â€"/g, '—')    // Em dash
    .replace(/â€"/g, '–')    // En dash
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    
    // Other symbols
    .replace(/â€¢/g, '•')    // Bullet point
    .replace(/â€¦/g, '…')    // Horizontal ellipsis
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Remove visual noise and broken decorative characters
 */
function removeVisualNoise(content: string): string {
  return content
    // Remove broken UTF-8 decorative characters
    .replace(/âÍ/g, '')
    .replace(/Â­/g, '')      // Soft hyphens
    .replace(/Â /g, ' ')     // Non-breaking spaces
    .replace(/Â/g, '')       // Stray UTF-8 artifacts
    
    // Remove sequences of broken characters (often decorative borders)
    .replace(/[âÍÂ­]{3,}/g, '')
    .replace(/(\s*[âÍÂ­]\s*){3,}/g, '')
    
    // Remove excessive decorative characters
    .replace(/[=\-_]{10,}/g, '___')  // Long lines of decorative chars
    .replace(/[*•]{5,}/g, '•••')     // Multiple bullets
    
    // Clean up whitespace
    .replace(/\s{3,}/g, '  ')        // Multiple spaces
    .replace(/\n{3,}/g, '\n\n')      // Multiple newlines
    .replace(/^\s+|\s+$/gm, '');     // Leading/trailing whitespace per line
}

/**
 * Fix HTML-specific content issues
 */
function fixHTMLContent(content: string, options: { fixImages: boolean; preserveFormatting: boolean }): string {
  let htmlContent = content;

  // Remove style tags and their content completely
  htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove problematic CSS classes and inline styles that interfere
  htmlContent = htmlContent
    .replace(/class="[^"]*outlook[^"]*"/gi, '')
    .replace(/class="[^"]*mso[^"]*"/gi, '')
    .replace(/style="[^"]*mso-[^"]*[^"]*"/gi, '');

  if (options.fixImages) {
    // Fix image tags
    htmlContent = htmlContent.replace(/<img([^>]*?)>/gi, (match, attrs) => {
      let fixedAttrs = attrs;
      
      // Add alt text if missing
      if (!fixedAttrs.includes('alt=')) {
        fixedAttrs += ' alt="Bild"';
      }
      
      // Add responsive styles
      const responsiveStyle = 'max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0; display: block;';
      
      if (fixedAttrs.includes('style=')) {
        fixedAttrs = fixedAttrs.replace(/style=["']([^"']*?)["']/i, `style="$1 ${responsiveStyle}"`);
      } else {
        fixedAttrs += ` style="${responsiveStyle}"`;
      }
      
      return `<img${fixedAttrs}>`;
    });
  }

  // Fix broken links and improve their styling
  htmlContent = htmlContent.replace(/<a([^>]*?)>/gi, (match, attrs) => {
    // Remove problematic Outlook-specific attributes
    attrs = attrs.replace(/target="_blank"/gi, 'target="_blank" rel="noopener noreferrer"');
    
    if (!attrs.includes('style=')) {
      attrs += ' style="color: #2563eb; text-decoration: underline; font-weight: 500;"';
    }
    return `<a${attrs}>`;
  });

  // Clean up table-based layouts (common in email HTML)
  htmlContent = cleanupEmailTables(htmlContent);

  // Remove broken character sequences between HTML tags
  htmlContent = htmlContent.replace(/>[\s]*[âÍÂ­\s]*</g, '><');

  if (options.preserveFormatting) {
    // Ensure proper paragraph breaks
    htmlContent = htmlContent.replace(/(<\/p>)\s*(<p>)/gi, '$1\n$2');
    
    // Fix common email formatting issues
    htmlContent = htmlContent
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>') // Double BR to paragraphs
      .replace(/&nbsp;/gi, ' '); // Non-breaking spaces to regular spaces
  }

  return htmlContent;
}

/**
 * Clean up email table layouts for better display
 */
function cleanupEmailTables(content: string): string {
  return content
    // Remove width attributes that cause layout issues
    .replace(/\s*width="[^"]*"/gi, '')
    .replace(/\s*height="[^"]*"/gi, '')
    
    // Add responsive table styling
    .replace(/<table([^>]*)>/gi, '<div class="email-table-wrapper"><table$1 style="width: 100%; max-width: 100%; table-layout: auto;">')
    .replace(/<\/table>/gi, '</table></div>')
    
    // Improve cell styling
    .replace(/<td([^>]*)>/gi, '<td$1 style="padding: 8px; vertical-align: top;">')
    
    // Remove spacer images
    .replace(/<img[^>]*spacer[^>]*>/gi, '')
    .replace(/<img[^>]*width="1"[^>]*>/gi, '')
    .replace(/<img[^>]*height="1"[^>]*>/gi, '');
}

/**
 * Format plain text content with intelligent paragraph detection
 */
function formatPlainTextContent(content: string, options: { addPhoneLinks: boolean; maxLineLength: number }): string {
  let textContent = content;

  // Break long lines at natural points before processing
  textContent = wrapLongLines(textContent, options.maxLineLength);

  // Detect and format email signatures
  textContent = formatEmailSignature(textContent);

  // Detect and format headers/sections  
  textContent = formatEmailSections(textContent);

  // Handle special Airbnb/service email patterns
  textContent = formatServiceEmails(textContent);

  // Convert line breaks to HTML, but preserve paragraph structure
  textContent = textContent.replace(/\r\n|\r|\n/g, '<br>');

  // Convert URLs to links (improved pattern)
  textContent = textContent.replace(
    /(?<!\()\s*(https?:\/\/[^\s<>")\]]+)(?!\s*\))/g,
    ' <a href="$1" style="color: #2563eb; text-decoration: underline; font-weight: 500; word-break: break-all;" target="_blank" rel="noopener noreferrer">🔗 Link ansehen</a>'
  );

  // Convert URLs in square brackets or parentheses to cleaner format
  textContent = textContent.replace(
    /[\[\(]\s*(https?:\/\/[^\s<>")\]]+)\s*[\]\)]/g,
    '<div style="margin: 8px 0;"><a href="$1" style="color: #2563eb; text-decoration: underline; font-weight: 500; display: inline-block; padding: 4px 8px; background-color: #f1f5f9; border-radius: 4px; word-break: break-all;" target="_blank" rel="noopener noreferrer">🔗 Link ansehen</a></div>'
  );

  // Convert email addresses to links
  textContent = textContent.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" style="color: #2563eb; text-decoration: underline;">$1</a>'
  );

  if (options.addPhoneLinks) {
    // Convert German phone numbers to links
    textContent = textContent.replace(
      /(\+49\s?[\d\s\-\/\(\)]{8,}|\b0[\d\s\-\/\(\)]{8,})/g,
      '<a href="tel:$1" style="color: #2563eb; text-decoration: underline;">$1</a>'
    );
  }

  // Create proper paragraphs from sentence breaks
  textContent = formatIntoParagraphs(textContent);

  // Format social media and footer links
  textContent = formatSocialLinks(textContent);

  return textContent;
}

/**
 * Wrap long lines at natural break points
 */
function wrapLongLines(content: string, maxLength: number): string {
  return content.split('\n').map(line => {
    if (line.length <= maxLength) return line;
    
    // Don't break URLs
    if (/^https?:\/\//.test(line.trim())) return line;
    
    // Find natural break points
    const words = line.split(' ');
    const wrapped = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) wrapped.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) wrapped.push(currentLine);
    return wrapped.join('\n');
  }).join('\n');
}

/**
 * Format service emails (Airbnb, booking sites, etc.)
 */
function formatServiceEmails(content: string): string {
  let formatted = content;
  
  // Format rating/review prompts
  formatted = formatted.replace(
    /(DU HAST NUR NOCH \d+ TAGE? ZEIT[^\.]+)/gi,
    '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; font-weight: 600;">$1</div>'
  );
  
  // Format rating options
  formatted = formatted.replace(
    /(Schrecklich|Schlecht|Okay|Gut|Sehr gut)(\[\s*https[^\]]+\])/gi,
    '<div style="margin: 8px 0; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;"><strong>$1</strong> $2</div>'
  );
  
  // Format call-to-action text
  formatted = formatted.replace(
    /(Bewerte deinen Aufenthalt|Eine Bewertung schreiben|Dies ist deine letzte Chance)/gi,
    '<strong style="color: #1f2937;">$1</strong>'
  );
  
  return formatted;
}

/**
 * Format email signatures and footers
 */
function formatEmailSignature(content: string): string {
  // Detect signature patterns
  const signaturePatterns = [
    /(\nBest regards?,.*?)$/si,
    /(\nMit freundlichen Grüßen,.*?)$/si,
    /(\nCheers?,.*?)$/si,
    /(\n[A-Z][a-z]+ [A-Z][a-z]+\s*$)/m,
    /(©\d{4}.*?$)/si,
    /(Unsubscribe.*?$)/si
  ];

  let formattedContent = content;

  signaturePatterns.forEach(pattern => {
    formattedContent = formattedContent.replace(pattern, (match) => {
      return `\n<div class="email-signature" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 0.875rem; color: #6b7280;">${match.trim()}</div>`;
    });
  });

  return formattedContent;
}

/**
 * Format email sections and headers
 */
function formatEmailSections(content: string): string {
  let formattedContent = content;

  // Format section headers (lines that end with colon or are followed by multiple lines)
  formattedContent = formattedContent.replace(
    /^([A-Z][^.!?]*[:])$/gm,
    '<h3 style="margin: 20px 0 10px 0; font-weight: 600; color: #1f2937; font-size: 1.1rem;">$1</h3>'
  );

  // Format emphasis on standalone lines
  formattedContent = formattedContent.replace(
    /^([A-Z][A-Z\s]{10,})$/gm,
    '<div style="font-weight: 600; color: #1f2937; margin: 15px 0;">$1</div>'
  );

  return formattedContent;
}

/**
 * Create proper paragraphs from content with intelligent text analysis
 */
function formatIntoParagraphs(content: string): string {
  // First, split by common paragraph markers and line patterns
  let text = content.replace(/<br\s*\/?>/g, '\n');
  
  // Split content into potential paragraphs using multiple delimiters
  const chunks = text.split(/\n{2,}|\.\s+(?=[A-Z])|[.!?]\s+(?=Hi |Hello |Dear |Check |Explore |Follow |Got |In the |Best |Mit freund)/);
  
  const paragraphs = [];
  
  chunks.forEach(chunk => {
    let trimmedChunk = chunk.trim();
    if (!trimmedChunk) return;
    
    // Detect different types of content
    if (isEmailGreeting(trimmedChunk)) {
      paragraphs.push(`<p style="margin: 0 0 20px 0; line-height: 1.6; font-weight: 500;">${trimmedChunk}</p>`);
    } else if (isEmailSignature(trimmedChunk)) {
      paragraphs.push(`<div class="email-signature" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 0.875rem; color: #6b7280;">${trimmedChunk}</div>`);
    } else if (isCallToAction(trimmedChunk)) {
      paragraphs.push(`<div style="margin: 20px 0; padding: 12px; background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">${trimmedChunk}</div>`);
    } else if (isSocialLinks(trimmedChunk)) {
      paragraphs.push(`<div style="margin: 16px 0; padding: 8px 0;">${formatSocialLinksInline(trimmedChunk)}</div>`);
    } else {
      // Regular paragraph
      paragraphs.push(`<p style="margin: 0 0 16px 0; line-height: 1.6;">${trimmedChunk}</p>`);
    }
  });

  return paragraphs.join('');
}

/**
 * Check if text is an email greeting
 */
function isEmailGreeting(text: string): boolean {
  return /^(Hi |Hello |Dear |Hallo |Liebe[r]? |Sehr geehrte[r]?)/i.test(text) && text.length < 100;
}

/**
 * Check if text is an email signature
 */
function isEmailSignature(text: string): boolean {
  return /^(Best regards?|Mit freundlichen Grüßen|Cheers?|Greetings|Viele Grüße)/i.test(text) ||
         /^[A-Z][a-z]+ [A-Z][a-z]+\s*$/m.test(text) ||
         /(Developer|Manager|CEO|CTO|Founder)/i.test(text);
}

/**
 * Check if text is a call to action
 */
function isCallToAction(text: string): boolean {
  return /(Work smarter|Use templates|Explore|Check|Follow|Submit|Take shortcuts|Don't miss)/i.test(text) &&
         text.length < 200;
}

/**
 * Check if text contains social media links
 */
function isSocialLinks(text: string): boolean {
  return /(GitHub|Discord|LinkedIn|YouTube|Twitter|Facebook|Instagram)/i.test(text) &&
         /(github\.com|discord\.gg|linkedin\.com|youtube\.com|twitter\.com)/i.test(text);
}

/**
 * Format social links inline
 */
function formatSocialLinksInline(text: string): string {
  return text
    .replace(/(GitHub|Discord|LinkedIn|YouTube|Twitter)/gi, '<strong>$1</strong>')
    .replace(/Follow us on/gi, '<strong>Follow us on</strong>');
}

/**
 * Format social media and footer links
 */
function formatSocialLinks(content: string): string {
  const socialPatterns = [
    { pattern: /Github\s*\(/g, replacement: '<strong>GitHub</strong> (' },
    { pattern: /Discord\s*\(/g, replacement: '<strong>Discord</strong> (' },
    { pattern: /Linkedin\s*\(/g, replacement: '<strong>LinkedIn</strong> (' },
    { pattern: /YouTube\s*\(/g, replacement: '<strong>YouTube</strong> (' },
    { pattern: /Follow us on/g, replacement: '<strong>Follow us on</strong>' },
    { pattern: /Automate without limits/g, replacement: '<strong style="font-size: 1.1rem; color: #1f2937;">Automate without limits</strong>' }
  ];

  let formattedContent = content;

  socialPatterns.forEach(({ pattern, replacement }) => {
    formattedContent = formattedContent.replace(pattern, replacement);
  });

  // Format the footer section
  formattedContent = formattedContent.replace(
    /(n8n GmbH,.*?Unsubscribe.*?)$/si,
    '<div class="email-disclaimer" style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; font-size: 0.75rem; color: #6b7280; border-left: 3px solid #cbd5e1;">$1</div>'
  );

  return formattedContent;
}

/**
 * Final cleanup and optimization
 */
function finalCleanup(content: string): string {
  return content
    // Remove empty HTML elements
    .replace(/<([a-z]+)[^>]*>\s*<\/\1>/gi, '')
    
    // Clean up excessive whitespace
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    
    // Fix spacing around HTML tags
    .replace(/\s*(<br\s*\/?>)\s*/gi, '$1')
    .replace(/(<\/[a-z]+>)\s*(<[a-z]+[^>]*>)/gi, '$1 $2')
    
    // Remove broken character sequences that might have been missed
    .replace(/[âÍÂ­]+/g, '')
    
    // Ensure proper sentence spacing
    .replace(/([.!?])\s*([A-ZÄÖÜ])/g, '$1 $2');
}

/**
 * Test function to validate email content cleaning
 */
export function testEmailCleaning(): void {
  const testCases = [
    {
      input: 'There are 4411 workflow templates for you to explore! âÍ âÍ âÍ âÍ âÍ âÍ âÍ âÍ âÍ',
      expected: 'There are 4411 workflow templates for you to explore!'
    },
    {
      input: 'Ã¤Ã¶Ã¼ ÃŸ â‚¬ â€™ â€œ â€"',
      expected: 'äöü ß € \' " —'
    },
    {
      input: 'Â­ Â­ Â­ Â­ Â­ Â­ Â­ Â­ Â­ Â­ Â­ Â­',
      expected: ''
    }
  ];

  testCases.forEach((testCase, index) => {
    const result = cleanEmailContent(testCase.input);
    console.log(`Test ${index + 1}:`, {
      input: testCase.input,
      expected: testCase.expected,
      result: result,
      passed: result.trim() === testCase.expected.trim()
    });
  });
}