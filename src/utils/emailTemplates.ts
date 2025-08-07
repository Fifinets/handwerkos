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
 * Base HTML email template with all required standards
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

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${options.subject}</title>
    <!--[if gte mso 9]>
    <xml>
        <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->
    <style type="text/css">
        @media only screen and (max-width: 600px) {
            .mobile-center { text-align: center !important; }
            .mobile-full-width { width: 100% !important; }
            .mobile-padding { padding: 20px !important; }
            .mobile-hide { display: none !important; }
            .mobile-button {
                display: block !important;
                width: auto !important;
                min-height: 44px !important;
                padding: 12px 20px !important;
                text-align: center !important;
            }
        }
        @media only screen and (max-width: 480px) {
            .mobile-small-padding { padding: 15px !important; }
            .mobile-small-text { font-size: 14px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    <!-- Preheader Text (hidden) -->
    <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f4f4f4;">
        ${preheader}
    </div>
    
    <!-- Main Container -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" valign="top" style="padding: 20px 10px;">
                
                <!-- Email Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" class="mobile-full-width">
                    
                    <!-- Header -->
                    ${logoUrl ? `
                    <tr>
                        <td align="center" style="padding: 30px 40px 20px; background-color: #1a365d; border-radius: 8px 8px 0 0;" class="mobile-padding">
                            <img src="${logoUrl}" alt="${companyName}" style="display: block; width: auto; height: 40px; max-width: 200px;" />
                        </td>
                    </tr>
                    ` : `
                    <tr>
                        <td align="center" style="padding: 30px 40px 20px; background-color: #1a365d; border-radius: 8px 8px 0 0;" class="mobile-padding">
                            <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; line-height: 1.2;">
                                ${companyName}
                            </h1>
                        </td>
                    </tr>
                    `}
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;" class="mobile-padding">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;" class="mobile-padding">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 20px;">
                                        <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                                            <strong>${companyName}</strong><br>
                                            ${companyEmail ? `E-Mail: <a href="mailto:${companyEmail}" style="color: #1a365d; text-decoration: none;">${companyEmail}</a>` : ''}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="border-top: 1px solid #e9ecef; padding-top: 20px;">
                                        <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #adb5bd; line-height: 1.4;">
                                            Sie erhalten diese E-Mail, weil Sie ein registrierter Nutzer von ${companyName} sind.<br>
                                            <a href="${unsubscribeUrl}" style="color: #6c757d; text-decoration: underline;">Abmelden</a>
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
</body>
</html>`;
}

/**
 * Email reply template with professional formatting
 */
export function createEmailReplyTemplate(options: ReplyTemplateOptions): string {
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
            <td>
                <h2 style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: bold; color: #1a365d; line-height: 1.2;">
                    Antwort auf: ${options.originalSubject}
                </h2>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px; background-color: #f8f9fa; border-left: 4px solid #1a365d; margin-bottom: 30px;">
                <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                    <strong>Ursprüngliche Nachricht von:</strong> ${options.originalSender}
                </p>
            </td>
        </tr>
        <tr>
            <td>
                <div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    ${options.replyContent.replace(/\n/g, '<br>')}
                </div>
            </td>
        </tr>
        <tr>
            <td style="padding-top: 30px;">
                <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6c757d; line-height: 1.4;">
                    Mit freundlichen Grüßen,<br>
                    <strong>${options.senderName}</strong>
                </p>
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