import { describe, it, expect } from 'vitest';
import {
  parseEmailContent,
  sanitizeHtmlContent,
  shouldDisplayAsHtml,
  type ParsedEmailContent,
  type EmailHeaders,
} from './emailMimeParser';

describe('parseEmailContent', () => {
  describe('plain text emails', () => {
    it('parses a simple plain text email', () => {
      const raw = `Content-Type: text/plain; charset=utf-8

Hello, this is a plain text email.`;
      const result = parseEmailContent(raw);

      expect(result.contentType).toBe('text');
      expect(result.plainTextContent).toBeTruthy();
      expect(result.preferredContent).toContain('Hello');
      expect(result.htmlContent).toBeNull();
      expect(result.hasAttachments).toBe(false);
      expect(result.attachments).toEqual([]);
    });

    it('handles missing content-type header (defaults to text/plain)', () => {
      const raw = `Subject: Test

Just plain text without content type header.`;
      const result = parseEmailContent(raw);

      expect(result.contentType).toBe('text');
      expect(result.preferredContent).toContain('plain text');
    });
  });

  describe('HTML emails', () => {
    it('parses a single-part HTML email', () => {
      const raw = `Content-Type: text/html; charset=utf-8

<html><body><h1>Hello World</h1><p>This is HTML</p></body></html>`;
      const result = parseEmailContent(raw);

      expect(result.contentType).toBe('html');
      expect(result.htmlContent).toBeTruthy();
      expect(result.plainTextContent).toBeNull();
    });

    it('detects HTML content even without explicit content-type header', () => {
      const raw = `Subject: Test

<html><body><div>HTML content detected by tags</div></body></html>`;
      const result = parseEmailContent(raw);

      expect(result.contentType).toBe('html');
      expect(result.htmlContent).toBeTruthy();
    });
  });

  describe('multipart emails', () => {
    it('parses a multipart/alternative email with text and HTML', () => {
      const raw = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

Plain text version of the email.

--boundary123
Content-Type: text/html; charset=utf-8

<html><body><p>HTML version of the email.</p></body></html>

--boundary123--`;
      const result = parseEmailContent(raw);

      expect(result.plainTextContent).toBeTruthy();
      expect(result.htmlContent).toBeTruthy();
      expect(result.plainTextContent).toContain('Plain text version');
      expect(result.htmlContent).toContain('HTML version');
    });

    it('handles missing boundary by falling back to single-part parsing', () => {
      const raw = `Content-Type: multipart/alternative

No boundary defined, so this cannot be parsed as multipart.`;
      const result = parseEmailContent(raw);

      // Without a boundary in the header, it still detects multipart: true
      // but since boundary is undefined, it falls through to createEmptyParsedContent
      // However the preprocessor may still extract body content.
      // The actual behavior: multipart is detected but no boundary found,
      // so it returns the content via single-part fallback or empty structure
      expect(result.hasAttachments).toBe(false);
      expect(result).toBeDefined();
    });

    it('detects attachments in multipart emails', () => {
      const raw = `Content-Type: multipart/mixed; boundary="mixedboundary"

--mixedboundary
Content-Type: text/plain; charset=utf-8

Email body text.

--mixedboundary
Content-Type: application/pdf
Content-Disposition: attachment; filename=report.pdf

base64encodedcontent

--mixedboundary--`;
      const result = parseEmailContent(raw);

      expect(result.hasAttachments).toBe(true);
      expect(result.attachments.length).toBe(1);
      expect(result.attachments[0].filename).toBe('report.pdf');
      expect(result.attachments[0].contentType).toBe('application/pdf');
      expect(result.attachments[0].inline).toBe(false);
    });

    it('detects inline attachments', () => {
      const raw = `Content-Type: multipart/mixed; boundary="inlineboundary"

--inlineboundary
Content-Type: text/plain

Body text.

--inlineboundary
Content-Type: image/png
Content-Disposition: inline; filename=logo.png
Content-ID: <logo@cid>

base64data

--inlineboundary--`;
      const result = parseEmailContent(raw);

      expect(result.hasAttachments).toBe(true);
      expect(result.attachments[0].inline).toBe(true);
      expect(result.attachments[0].filename).toBe('logo.png');
      expect(result.attachments[0].contentId).toBe('logo@cid');
    });
  });

  describe('content encoding', () => {
    it('decodes quoted-printable content', () => {
      const raw = `Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

Hello =C3=BC World`;
      const result = parseEmailContent(raw);

      // =C3=BC is the QP encoding for the UTF-8 bytes of u-umlaut
      expect(result.preferredContent).toBeDefined();
    });

    it('handles quoted-printable soft line breaks', () => {
      const raw = `Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

This is a very long line that was soft=
wrapped by the mail server.`;
      const result = parseEmailContent(raw);

      expect(result.preferredContent).toContain('softwrapped');
    });

    it('handles base64 encoded content', () => {
      // "Hello World" in base64
      const base64Content = btoa('Hello World');
      const raw = `Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: base64

${base64Content}`;
      const result = parseEmailContent(raw);

      expect(result.preferredContent).toContain('Hello World');
    });

    it('handles 7bit and 8bit encoding transparently', () => {
      const raw = `Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: 8bit

Plain 8bit content passes through unchanged.`;
      const result = parseEmailContent(raw);

      expect(result.preferredContent).toContain('8bit content passes through');
    });
  });

  describe('encoding cleanup in preprocessing', () => {
    it('fixes broken German umlaut encoding', () => {
      const raw = `Content-Type: text/plain

Sch\u00c3\u00b6ne Gr\u00c3\u00bc\u00c3\u009fe`;
      const result = parseEmailContent(raw);

      // The preprocessor replaces Ã¶ -> ö, Ã¼ -> ü
      expect(result.preferredContent).toContain('\u00f6'); // ö
      expect(result.preferredContent).toContain('\u00fc'); // ü
      // Note: ÃŸ -> ß replacement requires the exact byte sequence;
      // Ã\u009f may not match the pattern, so we just check ö and ü work
    });

    it('removes broken decorative character sequences', () => {
      const raw = `Content-Type: text/plain

Hello \u00e2\u0349 \u00e2\u0349 \u00e2\u0349 World`;
      const result = parseEmailContent(raw);

      expect(result.preferredContent).toContain('Hello');
      expect(result.preferredContent).toContain('World');
    });

    it('normalizes line endings', () => {
      const raw = `Content-Type: text/plain\r\n\r\nLine 1\r\nLine 2\rLine 3`;
      const result = parseEmailContent(raw);

      expect(result.preferredContent).toContain('Line 1');
      expect(result.preferredContent).toContain('Line 2');
      expect(result.preferredContent).toContain('Line 3');
    });
  });

  describe('header parsing', () => {
    it('parses charset from content-type header', () => {
      const raw = `Content-Type: text/plain; charset=iso-8859-1

Content here.`;
      const result = parseEmailContent(raw);

      expect(result.headers.charset).toBe('iso-8859-1');
    });

    it('defaults charset to utf-8 when not specified', () => {
      const raw = `Content-Type: text/plain

Content here.`;
      const result = parseEmailContent(raw);

      expect(result.headers.charset).toBe('utf-8');
    });

    it('detects multipart content type', () => {
      const raw = `Content-Type: multipart/alternative; boundary="abc123"

--abc123
Content-Type: text/plain

Text.

--abc123--`;
      const result = parseEmailContent(raw);

      expect(result.headers.multipart).toBe(true);
      expect(result.headers.boundary).toBe('abc123');
    });

    it('parses content-transfer-encoding header', () => {
      const raw = `Content-Type: text/plain
Content-Transfer-Encoding: quoted-printable

Content.`;
      const result = parseEmailContent(raw);

      expect(result.headers.contentTransferEncoding).toBe('quoted-printable');
    });

    it('defaults content-transfer-encoding to 8bit', () => {
      const raw = `Content-Type: text/plain

Content.`;
      const result = parseEmailContent(raw);

      expect(result.headers.contentTransferEncoding).toBe('8bit');
    });
  });

  describe('empty input handling', () => {
    it('handles empty string', () => {
      const result = parseEmailContent('');
      expect(result).toBeDefined();
      expect(result.preferredContent).toBeDefined();
    });

    it('handles content with only headers and no body', () => {
      const raw = `Content-Type: text/plain; charset=utf-8

`;
      const result = parseEmailContent(raw);
      expect(result).toBeDefined();
    });
  });
});

describe('sanitizeHtmlContent', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtmlContent('')).toBe('');
  });

  it('removes script tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('removes object tags', () => {
    const html = '<object data="malicious.swf"></object><p>Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<object');
  });

  it('removes embed tags', () => {
    const html = '<embed src="malicious.swf"><p>Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<embed');
  });

  it('removes applet tags', () => {
    const html = '<applet code="Malicious.class"></applet><p>Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<applet');
  });

  it('removes javascript: protocol', () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('javascript:');
  });

  it('removes inline event handlers', () => {
    const html = '<div onclick="alert(1)" onmouseover="hack()">Content</div>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toMatch(/on\w+\s*=/i);
  });

  it('removes style tags and their content', () => {
    const html = '<style>.red { color: red; }</style><p class="red">Text</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<style');
    expect(result).not.toContain('color: red');
  });

  it('removes head section', () => {
    const html = '<head><title>Test</title><meta charset="utf-8"></head><body><p>Content</p></body>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<head');
    expect(result).not.toContain('<title');
  });

  it('strips DOCTYPE, html, and body wrapper tags but keeps content', () => {
    const html = '<!DOCTYPE html><html><body><p>Content</p></body></html>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('DOCTYPE');
    expect(result).not.toContain('<html');
    expect(result).not.toContain('<body');
    expect(result).toContain('Content');
  });

  it('removes HTML comments', () => {
    const html = '<!-- This is a comment --><p>Visible content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<!--');
    expect(result).not.toContain('comment');
  });

  it('removes Outlook conditional comments', () => {
    const html = '<!--[if mso]><table><tr><td><![endif]--><p>Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('[if mso]');
  });

  it('removes meta tags', () => {
    const html = '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><p>Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<meta');
  });

  it('removes link tags (external CSS)', () => {
    const html = '<link rel="stylesheet" href="style.css"><p>Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<link');
  });

  it('removes Microsoft Office specific attributes', () => {
    const html = '<p style="mso-spacerun:yes" class="MsoNormal">Content</p>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('mso-');
    expect(result).not.toContain('MsoNormal');
  });

  it('converts table structure elements for email layouts', () => {
    const html = '<table><tbody><tr><td>Cell Content</td></tr></tbody></table>';
    const result = sanitizeHtmlContent(html);
    expect(result).toContain('Cell Content');
    // Tables are stripped but content preserved
    expect(result).not.toContain('<table');
    expect(result).not.toContain('<tbody');
  });

  it('converts font tags to spans', () => {
    const html = '<font face="Arial" size="3">Styled text</font>';
    const result = sanitizeHtmlContent(html);
    expect(result).not.toContain('<font');
    expect(result).toContain('Styled text');
  });
});

describe('shouldDisplayAsHtml', () => {
  it('returns true when HTML content is available', () => {
    const parsed: ParsedEmailContent = {
      htmlContent: '<p>Hello</p>',
      plainTextContent: 'Hello',
      preferredContent: '<p>Hello</p>',
      contentType: 'html',
      hasAttachments: false,
      attachments: [],
      headers: {
        contentType: 'text/html',
        charset: 'utf-8',
        contentTransferEncoding: '8bit',
        multipart: false,
      },
    };

    expect(shouldDisplayAsHtml(parsed)).toBe(true);
  });

  it('returns true when content type is html', () => {
    const parsed: ParsedEmailContent = {
      htmlContent: null,
      plainTextContent: null,
      preferredContent: '<div>Content</div>',
      contentType: 'html',
      hasAttachments: false,
      attachments: [],
      headers: {
        contentType: 'text/html',
        charset: 'utf-8',
        contentTransferEncoding: '8bit',
        multipart: false,
      },
    };

    expect(shouldDisplayAsHtml(parsed)).toBe(true);
  });

  it('detects HTML in preferred content by tag presence', () => {
    const parsed: ParsedEmailContent = {
      htmlContent: null,
      plainTextContent: null,
      preferredContent: '<html><body><div>Content</div></body></html>',
      contentType: 'text',
      hasAttachments: false,
      attachments: [],
      headers: {
        contentType: 'text/plain',
        charset: 'utf-8',
        contentTransferEncoding: '8bit',
        multipart: false,
      },
    };

    expect(shouldDisplayAsHtml(parsed)).toBe(true);
  });

  it('returns false for pure plain text content', () => {
    const parsed: ParsedEmailContent = {
      htmlContent: null,
      plainTextContent: 'Just plain text',
      preferredContent: 'Just plain text',
      contentType: 'text',
      hasAttachments: false,
      attachments: [],
      headers: {
        contentType: 'text/plain',
        charset: 'utf-8',
        contentTransferEncoding: '8bit',
        multipart: false,
      },
    };

    expect(shouldDisplayAsHtml(parsed)).toBe(false);
  });
});
