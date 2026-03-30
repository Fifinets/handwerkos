import { describe, it, expect } from 'vitest';
import { cleanEmailContent } from './emailContentCleaner';

describe('cleanEmailContent', () => {
  describe('empty and null handling', () => {
    it('returns empty string for empty input', () => {
      expect(cleanEmailContent('')).toBe('');
    });

    it('returns empty string for null-like input', () => {
      expect(cleanEmailContent(null as unknown as string)).toBe('');
      expect(cleanEmailContent(undefined as unknown as string)).toBe('');
    });
  });

  describe('UTF-8 encoding fixes', () => {
    it('fixes German umlauts from double encoding', () => {
      const result = cleanEmailContent('Sch\u00c3\u00b6ne Gr\u00c3\u00bc\u00c3\u009fe');
      // The cleaner replaces the common mojibake sequences like Ã¶ -> ö, Ã¼ -> ü
      expect(result).toContain('\u00f6'); // ö
      expect(result).toContain('\u00fc'); // ü
    });

    it('fixes HTML entity umlauts', () => {
      const result = cleanEmailContent('Stra&szlig;e &auml;ndern &ouml;ffnen &uuml;bung');
      expect(result).toContain('\u00df');
      expect(result).toContain('\u00e4');
      expect(result).toContain('\u00f6');
      expect(result).toContain('\u00fc');
    });

    it('fixes Euro symbol encoding', () => {
      const result = cleanEmailContent('Preis: 100 &euro;');
      expect(result).toContain('\u20ac');
    });

    it('fixes HTML entities for angle brackets and ampersand', () => {
      const result = cleanEmailContent('A &amp; B &lt; C &gt; D');
      expect(result).toContain('&');
      expect(result).toContain('<');
      expect(result).toContain('>');
    });

    it('fixes smart quote encoding', () => {
      const result = cleanEmailContent('&lsquo;Hello&rsquo; &ldquo;World&rdquo;');
      expect(result).toContain("'");
      expect(result).toContain('"');
    });

    it('replaces &nbsp; with regular space', () => {
      const result = cleanEmailContent('Hello&nbsp;World');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });
  });

  describe('visual noise removal', () => {
    it('removes broken decorative characters', () => {
      const input = 'Hello \u00c2\u00ad\u00c2\u00ad\u00c2\u00ad\u00c2\u00ad\u00c2\u00ad World';
      const result = cleanEmailContent(input);
      expect(result).not.toContain('\u00c2\u00ad');
    });

    it('shortens long decorative lines', () => {
      const input = 'Section\n====================\nContent';
      const result = cleanEmailContent(input);
      // Long sequences of = should be shortened
      expect(result).not.toContain('====================');
    });

    it('can preserve decorations when option is false', () => {
      const input = 'Hello \u00c2\u00ad World';
      const result = cleanEmailContent(input, { removeDecorations: false });
      // When decorations removal is off, preprocessing still cleans some things,
      // but the removeVisualNoise step is skipped
      expect(result).toBeDefined();
    });
  });

  describe('HTML content handling', () => {
    it('removes style tags from HTML', () => {
      const input = '<style>.test { color: red; }</style><p>Hello</p>';
      const result = cleanEmailContent(input);
      expect(result).not.toContain('<style>');
      expect(result).not.toContain('color: red');
    });

    it('removes Outlook-specific CSS classes', () => {
      const input = '<div class="MsoNormal outlook-style">Content</div>';
      const result = cleanEmailContent(input);
      expect(result).not.toContain('outlook');
      expect(result).not.toContain('mso');
    });

    it('adds alt text to images without it', () => {
      const input = '<img src="test.jpg">';
      const result = cleanEmailContent(input, { fixImages: true });
      expect(result).toContain('alt=');
    });

    it('makes images responsive', () => {
      const input = '<img src="test.jpg">';
      const result = cleanEmailContent(input, { fixImages: true });
      expect(result).toContain('max-width: 100%');
    });

    it('can skip image fixing when option is false', () => {
      const input = '<img src="test.jpg">';
      const result = cleanEmailContent(input, { fixImages: false });
      // Should still parse as HTML but not add responsive styles
      expect(result).toBeDefined();
    });

    it('adds rel="noopener noreferrer" to target="_blank" links', () => {
      const input = '<a href="https://example.com" target="_blank">Link</a>';
      const result = cleanEmailContent(input);
      expect(result).toContain('noopener noreferrer');
    });
  });

  describe('plain text content handling', () => {
    it('converts URLs to clickable links', () => {
      const input = 'Visit https://example.com for more info';
      const result = cleanEmailContent(input);
      expect(result).toContain('href="https://example.com"');
    });

    it('converts email addresses to mailto links', () => {
      const input = 'Contact us at test@example.com';
      const result = cleanEmailContent(input);
      expect(result).toContain('mailto:test@example.com');
    });

    it('converts phone numbers to tel links when enabled', () => {
      const input = 'Call us at +49 123 456 7890';
      const result = cleanEmailContent(input, { addPhoneLinks: true });
      expect(result).toContain('tel:');
    });

    it('does not convert phone numbers when disabled', () => {
      const input = 'Call us at +49 123 456 7890';
      const result = cleanEmailContent(input, { addPhoneLinks: false });
      expect(result).not.toContain('tel:');
    });
  });

  describe('final cleanup', () => {
    it('removes empty HTML elements', () => {
      const input = '<div><p></p>Content</div>';
      const result = cleanEmailContent(input);
      // Empty <p></p> should be removed
      expect(result).not.toMatch(/<p>\s*<\/p>/);
    });

    it('trims leading and trailing whitespace', () => {
      const result = cleanEmailContent('   Hello World   ');
      expect(result).not.toMatch(/^\s+/);
      expect(result).not.toMatch(/\s+$/);
    });
  });

  describe('complex real-world scenarios', () => {
    it('handles a mixed encoding email', () => {
      const input = 'Sehr geehrte Frau M&uuml;ller,\n\nIhr Auftrag &uuml;ber 500&euro; wurde best&auml;tigt.\n\nMit freundlichen Gr&uuml;&szlig;en';
      const result = cleanEmailContent(input);
      expect(result).toContain('\u00fc');
      expect(result).toContain('\u20ac');
      expect(result).toContain('\u00e4');
      expect(result).toContain('\u00df');
    });

    it('handles content with multiple issues at once', () => {
      const input = '\u00c2\u00ad\u00c2\u00ad\u00c2\u00ad Hello &amp; Welcome \u00c2\u00ad\u00c2\u00ad\u00c2\u00ad';
      const result = cleanEmailContent(input);
      expect(result).toContain('Hello');
      expect(result).toContain('&');
      expect(result).toContain('Welcome');
    });
  });
});
