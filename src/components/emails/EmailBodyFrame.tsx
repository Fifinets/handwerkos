import { useEffect, useRef, useState } from 'react';

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

/**
 * Repair UTF-8 → Latin-1 → UTF-8 mojibake.
 *
 * Symptom: "Weâre here" displays as "Weâ□□re here" instead
 * of "We're here". The bytes 0xE2 0x80 0x99 (UTF-8 for the right-single-quote)
 * were decoded as three Latin-1 chars, then re-encoded as UTF-8.
 *
 * Fix: read each JS char as a single byte and decode the byte sequence
 * as UTF-8. Only runs when the string actually has classic mojibake markers
 * so correctly-encoded text isn't mangled.
 *
 * Real fix belongs in sync-gmail-emails (set the right charset on the MIME
 * part). This is a client-side rescue for what's already in the DB.
 */
function repairMojibake(s: string): string {
  if (!s) return s;
  if (!looksLikeMojibake(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code > 0xff) return s; // not a Latin-1-shaped string, abort
      bytes[i] = code;
    }
    const repaired = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // Sanity check: the repaired version should have FEWER mojibake markers,
    // otherwise we made it worse and should keep the original.
    return countMojibake(repaired) < countMojibake(s) ? repaired : s;
  } catch {
    return s;
  }
}

// Two mojibake families:
//   â + (0x80..0x9F)   — `â` followed by C1 control char (the unrenderable
//                              squares in the user's Google Cloud screenshot).
//   Ã + (0x80..0xBF)   — `Ã{vowel}`, classic mojibake of German umlauts /
//                              accented Latin chars.
//   Â + (0xA0..0xBF)   — `Â{punct}`, e.g. `Â ` for non-breaking-space.
const MOJIBAKE_MARKERS_SOURCE = '\\u00e2[\\u0080-\\u009f]|\\u00c3[\\u0080-\\u00bf]|\\u00c2[\\u00a0-\\u00bf]';

function looksLikeMojibake(s: string): boolean {
  return new RegExp(MOJIBAKE_MARKERS_SOURCE).test(s);
}

function countMojibake(s: string): number {
  const matches = s.match(new RegExp(MOJIBAKE_MARKERS_SOURCE, 'g'));
  return matches ? matches.length : 0;
}
