/**
 * Plain text email templates for maximum compatibility
 * Every HTML email must have a plain text counterpart
 */

export interface PlainTextEmailOptions {
  companyName?: string;
  companyEmail?: string;
  unsubscribeUrl?: string;
}

export interface PlainTextReplyOptions extends PlainTextEmailOptions {
  originalSubject: string;
  originalSender: string;
  replyContent: string;
  senderName: string;
}

export interface PlainTextNotificationOptions extends PlainTextEmailOptions {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Create plain text version of reply email
 */
export function createPlainTextReply(options: PlainTextReplyOptions): string {
  const {
    originalSubject,
    originalSender,
    replyContent,
    senderName,
    companyName = 'HandwerkOS',
    companyEmail = '',
    unsubscribeUrl = '#'
  } = options;

  return `Antwort auf: ${originalSubject}

Ursprüngliche Nachricht von: ${originalSender}

${replyContent}

Mit freundlichen Grüßen,
${senderName}

---
${companyName}
${companyEmail ? `E-Mail: ${companyEmail}` : ''}

Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
Abmelden: ${unsubscribeUrl}`;
}

/**
 * Create plain text version of welcome email
 */
export function createPlainTextWelcome(
  employeeName: string,
  companyName: string,
  loginUrl: string,
  options: PlainTextEmailOptions = {}
): string {
  const {
    companyEmail = '',
    unsubscribeUrl = '#'
  } = options;

  return `Willkommen bei ${companyName}!

Hallo ${employeeName},

herzlich willkommen im Team! Ihr Account wurde erfolgreich erstellt und Sie können sich ab sofort in unserem System anmelden.

Jetzt anmelden: ${loginUrl}

Bei Fragen können Sie sich jederzeit an unser Support-Team wenden.

Mit freundlichen Grüßen,
${companyName}

---
${companyName}
${companyEmail ? `E-Mail: ${companyEmail}` : ''}

Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
Abmelden: ${unsubscribeUrl}`;
}

/**
 * Create plain text version of notification email
 */
export function createPlainTextNotification(options: PlainTextNotificationOptions): string {
  const {
    title,
    message,
    actionUrl = '',
    actionText = '',
    companyName = 'HandwerkOS',
    companyEmail = '',
    unsubscribeUrl = '#'
  } = options;

  return `${title}

${message}

${actionUrl && actionText ? `${actionText}: ${actionUrl}` : ''}

---
${companyName}
${companyEmail ? `E-Mail: ${companyEmail}` : ''}

Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
Abmelden: ${unsubscribeUrl}`;
}

/**
 * Create plain text version of project notification
 */
export function createPlainTextProjectNotification(
  projectName: string,
  status: string,
  message: string,
  options: PlainTextEmailOptions = {}
): string {
  const {
    companyName = 'HandwerkOS',
    companyEmail = '',
    unsubscribeUrl = '#'
  } = options;

  return `Projekt Update: ${projectName}

Status: ${status.toUpperCase()}

${message}

---
${companyName}
${companyEmail ? `E-Mail: ${companyEmail}` : ''}

Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
Abmelden: ${unsubscribeUrl}`;
}

/**
 * Convert HTML content to plain text (fallback)
 */
export function htmlToPlainText(html: string): string {
  return html
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    // Convert <br> to line breaks before removing tags
    .replace(/<br\s*\/?>/gi, '\n');
}

/**
 * Clean email content for plain text version
 */
export function cleanPlainTextContent(content: string): string {
  // Remove broken UTF-8 sequences
  let cleaned = content
    .replace(/âÍ/g, '')
    .replace(/Â­/g, '')
    .replace(/Â /g, ' ')
    .replace(/Â/g, '')
    // Fix German characters
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    .replace(/â‚¬/g, '€');

  // Clean up excessive whitespace and line breaks
  cleaned = cleaned
    .replace(/\s{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '');

  return cleaned;
}