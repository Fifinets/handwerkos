import { useEffect, useRef, useState } from 'react';
import { repairMojibake } from '@/lib/mojibake';

interface Props {
  /** Full HTML body (preferred). Empty string means fall back to plainText. */
  html: string;
  /** Plain-text body. Used when html is empty or when content itself is HTML stored in the plain column. */
  plainText: string;
}

/**
 * Renders an email body in a sandboxed iframe — the same approach Gmail and
 * Outlook take. Why:
 *
 *  - HTML emails carry their own CSS (often heavy table layouts, custom fonts,
 *    !important rules); rendering inline would bleed into the app and break
 *    everything.
 *  - HTML emails can contain malicious script tags. The sandbox attribute
 *    (without `allow-scripts`) disables JavaScript inside the frame.
 *  - The iframe declares its own charset=utf-8 so encoding issues are limited
 *    to what's already in the DB string.
 *
 * Auto-resizes to fit content so the user doesn't get a scrollbar-in-scrollbar.
 *
 * Fallback chain:
 *   1. html (preferred — proper HTML body from Gmail's text/html part)
 *   2. plainText that LOOKS like HTML (some senders stash HTML in the plain part)
 *   3. plainText rendered as <pre>-style text
 */
export function EmailBodyFrame({ html, plainText }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(400);

  const looksLikeHtml = (s: string) => /^\s*(<!doctype|<html|<head|<body|<div|<table)/i.test(s);
  // Repair mojibake BEFORE choosing html vs plain — both can be affected
  // (sync-gmail-emails stored the body with broken encoding for some senders).
  const repairedHtml = repairMojibake(html ?? '');
  const repairedPlain = repairMojibake(plainText ?? '');
  const effectiveHtml = repairedHtml.trim()
    ? repairedHtml
    : (looksLikeHtml(repairedPlain) ? repairedPlain : '');

  const srcDoc = effectiveHtml
    ? wrapHtml(effectiveHtml)
    : wrapPlainText(repairedPlain || '(kein Inhalt)');

  // After load, measure body scrollHeight + grow iframe to fit. Re-measure on
  // image loads (their final height isn't known until they decode).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const h = Math.min(doc.body.scrollHeight + 32, 5000);
      if (h > 0) setHeight(h);
    };

    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.querySelectorAll('img').forEach((img) => {
        img.addEventListener('load', measure);
        img.addEventListener('error', measure);
      });
    };

    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="E-Mail-Inhalt"
      srcDoc={srcDoc}
      // No `allow-scripts` → JavaScript inside the email is blocked.
      // We do allow same-origin so we can read scrollHeight back out.
      sandbox="allow-same-origin allow-popups"
      className="w-full border-0 bg-white"
      style={{ height: `${height}px` }}
    />
  );
}

function wrapHtml(body: string): string {
  if (/<html[\s>]/i.test(body)) {
    return body.replace(
      /<head([^>]*)>/i,
      '<head$1><meta charset="utf-8"><base target="_blank">'
    );
  }
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<base target="_blank">
<style>
  body { margin: 0; padding: 16px; font-family: -apple-system, system-ui, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6; word-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
</style>
</head><body>${body}</body></html>`;
}

function wrapPlainText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; font-family: -apple-system, system-ui, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }
</style></head><body>${escaped}</body></html>`;
}
