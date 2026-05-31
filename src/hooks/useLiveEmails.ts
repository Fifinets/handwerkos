import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { repairMojibake } from '@/lib/mojibake';

/**
 * UI-shaped Email used by EmailModuleV2.
 * Same fields as the legacy mock interface there, so the renderer doesn't
 * need to change.
 */
export interface LiveEmail {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  content: string;
  htmlContent: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  category?: 'Inquiry' | 'Invoice' | 'Support' | 'Newsletter';
}

interface EmailRow {
  id: string;
  subject: string | null;
  sender_email: string;
  sender_name: string | null;
  content: string | null;
  html_content: string | null;
  ai_summary: string | null;
  received_at: string;
  is_read: boolean | null;
  is_starred: boolean | null;
  email_categories: { name: string | null } | null;
}

function categoryFromName(name: string | null | undefined): LiveEmail['category'] {
  if (!name) return undefined;
  const n = name.toLowerCase();
  if (n.includes('anfrage') || n.includes('inquiry')) return 'Inquiry';
  if (n.includes('rechnung') || n.includes('invoice')) return 'Invoice';
  if (n.includes('support') || n.includes('reklamation')) return 'Support';
  if (n.includes('newsletter') || n.includes('neuigkeit')) return 'Newsletter';
  return undefined;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Gestern';
  }
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function rowToLiveEmail(row: EmailRow): LiveEmail {
  const fullContent = row.content?.trim() || '';
  const htmlContent = row.html_content?.trim() || '';
  // Preview prefers ai_summary (clean), then plain content, never HTML soup.
  // Repair mojibake here so the list preview ("Du hast 250,00€ EUR") doesn't
  // show "Du hast 250,00Â âÂ EUR" — same fix the EmailBodyFrame already does
  // for the body, but applied earlier so the sidebar list is also clean.
  const rawPreviewSource = row.ai_summary?.trim() || stripHtmlForPreview(fullContent);
  const previewSource = repairMojibake(rawPreviewSource);
  const preview = previewSource.length > 240
    ? previewSource.substring(0, 240) + '…'
    : previewSource;
  return {
    id: row.id,
    sender: repairMojibake(row.sender_name || row.sender_email),
    senderEmail: row.sender_email,
    subject: repairMojibake(row.subject || '(kein Betreff)'),
    preview,
    content: fullContent,
    htmlContent,
    date: formatDate(row.received_at),
    isRead: !!row.is_read,
    isStarred: !!row.is_starred,
    category: categoryFromName(row.email_categories?.name),
  };
}

/**
 * Strip HTML tags + collapse whitespace so an HTML body doesn't produce a
 * preview line full of `<html><head>...` markup. Cheap regex, NOT a sanitizer.
 */
function stripHtmlForPreview(text: string): string {
  if (!text) return '';
  // If it doesn't even look like HTML, leave it.
  if (!/<[a-z!/]/i.test(text)) return text;
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Loads the current user's emails from supabase. Relies on RLS to scope
 * to the user's company. Returns the legacy LiveEmail shape so EmailModuleV2
 * can swap mock → live without restructuring its render code.
 */
export function useLiveEmails() {
  const query = useQuery({
    queryKey: ['live-emails'],
    queryFn: async (): Promise<LiveEmail[]> => {
      const { data, error } = await supabase
        .from('emails')
        .select(
          'id, subject, sender_email, sender_name, content, html_content, ai_summary, received_at, is_read, is_starred, email_categories(name)'
        )
        .order('received_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('useLiveEmails error:', error);
        return [];
      }
      return (data ?? []).map((row) => rowToLiveEmail(row as unknown as EmailRow));
    },
  });

  return {
    emails: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
