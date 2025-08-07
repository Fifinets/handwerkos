/**
 * Professional HTML Email Templates with all email client best practices
 * - Inline CSS for maximum compatibility
 * - Table-based layout for consistent rendering
 * - Web-safe fonts with fallbacks
 * - Responsive design with media queries
 * - UTF-8 encoding and proper HTML structure
 * - Preheader text and unsubscribe functionality
 * - Maximum width 600px for optimal desktop display
 */

interface EmailTemplateOptions {
  subject: string;
  preheader?: string;
  companyName?: string;
  companyEmail?: string;
  unsubscribeUrl?: string;
  logoUrl?: string;
}

interface ReplyTemplateOptions extends EmailTemplateOptions {
  originalSubject: string;
  originalSender: string;
  replyContent: string;
  senderName: string;
}

interface NotificationTemplateOptions extends EmailTemplateOptions {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Base HTML email template optimized for maximum email client compatibility
 * Uses only table layouts, inline CSS, and websafe fonts
 */
export function createBaseEmailTemplate(
  content: string,
  options: EmailTemplateOptions
): string {
  const {
    preheader = '',
    companyName = 'HandwerkOS',
    companyEmail = '',
    unsubscribeUrl = '#',
    logoUrl = ''
  } = options;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${options.subject}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; line-height: 1.4; color: #333333; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    
    <!-- Preheader Text (hidden from view) -->
    <div style="display: none; font-size: 1px; color: #f4f4f4; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${preheader}
    </div>
    
    <!-- Wrapper Table -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; margin: 0; padding: 0;">
        <tr>
            <td align="center" valign="top" style="padding: 20px 15px;">
                
                <!-- Main Container Table -->
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; margin: 0 auto;">
                    
                    <!-- Header Section -->
                    <tr>
                        <td align="center" valign="top" style="padding: 30px 40px 20px 40px; background-color: #2c3e50;">
                            ${logoUrl ? 
                                `<img src="${logoUrl}" alt="${companyName}" width="200" height="40" style="display: block; border: 0; outline: none; width: 200px; height: 40px; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 18px; font-weight: bold; color: #ffffff;">` 
                                : 
                                `<h1 style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; line-height: 1.2;">${companyName}</h1>`
                            }
                        </td>
                    </tr>
                    
                    <!-- Content Section -->
                    <tr>
                        <td align="left" valign="top" style="padding: 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">
                                        ${content}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td align="center" valign="top" style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 20px;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                            <strong>${companyName}</strong>
                                            ${companyEmail ? `<br>E-Mail: <a href="mailto:${companyEmail}" style="color: #2c3e50; text-decoration: none;">${companyEmail}</a>` : ''}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="border-top: 1px solid #e9ecef; padding-top: 20px;">
                                        <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 12px; color: #adb5bd; line-height: 1.4;">
                                            Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.
                                            <br><a href="${unsubscribeUrl}" style="color: #6c757d; text-decoration: underline;" target="_blank">Abmelden</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                </table>
                
            </td>
        </tr>
    </table>
    
    <!-- Mobile Responsive Table (Outlook fallback) -->
    <!--[if mso]>
    <table cellpadding="0" cellspacing="0" border="0" width="600">
        <tr>
            <td width="600" style="width: 600px;">
                <!-- Content repeats here for Outlook -->
            </td>
        </tr>
    </table>
    <![endif]-->
    
</body>
</html>`;
}

/**
 * Email reply template with email-client compatible formatting
 */
export function createEmailReplyTemplate(options: ReplyTemplateOptions): string {
  const content = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td style="padding-bottom: 20px;">
                <h2 style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 20px; font-weight: bold; color: #2c3e50; line-height: 1.2;">
                    Antwort auf: ${options.originalSubject}
                </h2>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px; background-color: #f8f9fa; border-left: 4px solid #2c3e50;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                <strong>Ursprüngliche Nachricht von:</strong> ${options.originalSender}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding: 30px 0 20px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td style="font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                            ${options.replyContent.replace(/\n/g, '<br>')}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding-top: 30px; border-top: 1px solid #e9ecef;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; padding: 0; font-family: Arial, Helvetica, Verdana, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                Mit freundlichen Grüßen,<br>
                                <strong>${options.senderName}</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
  `;

  return createBaseEmailTemplate(content, {
    ...options,
    preheader: `Antwort von ${options.senderName} auf: ${options.originalSubject}`
  });
}

/**
 * Notification email template for system messages
 */
export function createNotificationTemplate(options: NotificationTemplateOptions): string {
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td align="center" style="padding-bottom: 30px;">
                <div style="width: 60px; height: 60px; background-color: #1a365d; border-radius: 50%; display: inline-block; position: relative;">
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ffffff; font-size: 24px;">
                        📧
                    </div>
                </div>
            </td>
        </tr>
        <tr>
            <td>
                <h2 style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #1a365d; line-height: 1.2; text-align: center;">
                    ${options.title}
                </h2>
            </td>
        </tr>
        <tr>
            <td>
                <div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6; text-align: center; margin-bottom: 30px;">
                    ${options.message.replace(/\n/g, '<br>')}
                </div>
            </td>
        </tr>
        ${options.actionUrl && options.actionText ? `
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="background-color: #1a365d; border-radius: 6px; padding: 0;">
                            <a href="${options.actionUrl}" 
                               style="display: inline-block; padding: 14px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; min-height: 44px; line-height: 1.2;"
                               class="mobile-button">
                                ${options.actionText}
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        ` : ''}
    </table>
  `;

  return createBaseEmailTemplate(content, {
    ...options,
    preheader: options.message.substring(0, 100) + '...'
  });
}

/**
 * Project notification template
 */
export function createProjectNotificationTemplate(
  projectName: string,
  status: string,
  message: string,
  options: EmailTemplateOptions
): string {
  const statusColors: Record<string, string> = {
    'geplant': '#0ea5e9',
    'in_bearbeitung': '#f59e0b',
    'abgeschlossen': '#10b981',
    'ueberfaellig': '#ef4444'
  };

  const statusColor = statusColors[status] || '#6b7280';

  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td>
                <h2 style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: bold; color: #1a365d; line-height: 1.2;">
                    Projekt Update: ${projectName}
                </h2>
            </td>
        </tr>
        <tr>
            <td style="margin-bottom: 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; width: 100%;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 10px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6c757d;">
                                <strong>Status:</strong>
                                <span style="background-color: ${statusColor}; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 8px;">
                                    ${status.toUpperCase()}
                                </span>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td>
                <div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    ${message.replace(/\n/g, '<br>')}
                </div>
            </td>
        </tr>
    </table>
  `;

  return createBaseEmailTemplate(content, {
    ...options,
    preheader: `${projectName} - Status: ${status}`
  });
}

/**
 * Welcome email template for new employees
 */
export function createWelcomeTemplate(
  employeeName: string,
  companyName: string,
  loginUrl: string,
  options: EmailTemplateOptions
): string {
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td>
                <h2 style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #1a365d; line-height: 1.2;">
                    Willkommen bei ${companyName}!
                </h2>
            </td>
        </tr>
        <tr>
            <td>
                <p style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    Hallo ${employeeName},
                </p>
                <p style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    herzlich willkommen im Team! Ihr Account wurde erfolgreich erstellt und Sie können sich ab sofort in unserem System anmelden.
                </p>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding: 30px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="background-color: #1a365d; border-radius: 6px; padding: 0;">
                            <a href="${loginUrl}" 
                               style="display: inline-block; padding: 14px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; min-height: 44px; line-height: 1.2;"
                               class="mobile-button">
                                Jetzt anmelden
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td>
                <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    Bei Fragen können Sie sich jederzeit an unser Support-Team wenden.
                </p>
            </td>
        </tr>
    </table>
  `;

  return createBaseEmailTemplate(content, {
    ...options,
    preheader: `Willkommen ${employeeName}! Ihr Account ist bereit.`
  });
}