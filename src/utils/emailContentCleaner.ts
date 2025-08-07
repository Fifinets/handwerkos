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
    maxLineLength = 80
  } = options;

  let cleanedContent = content;

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

  // Fix broken links
  htmlContent = htmlContent.replace(/<a([^>]*?)>/gi, (match, attrs) => {
    if (!attrs.includes('style=')) {
      attrs += ' style="color: #2563eb; text-decoration: underline;"';
    }
    return `<a${attrs}>`;
  });

  // Remove broken character sequences between HTML tags
  htmlContent = htmlContent.replace(/>[\s]*[âÍÂ­\s]*</g, '><');

  if (options.preserveFormatting) {
    // Ensure proper paragraph breaks
    htmlContent = htmlContent.replace(/(<\/p>)\s*(<p>)/gi, '$1\n$2');
  }

  return htmlContent;
}

/**
 * Format plain text content
 */
function formatPlainTextContent(content: string, options: { addPhoneLinks: boolean; maxLineLength: number }): string {
  let textContent = content;

  // Convert line breaks to HTML
  textContent = textContent.replace(/\r\n|\r|\n/g, '<br>');

  // Convert URLs to links
  textContent = textContent.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" style="color: #2563eb; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>'
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

  // Preserve paragraph breaks
  textContent = textContent.replace(/(<br>\s*){2,}/g, '<br><br>');

  return textContent;
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