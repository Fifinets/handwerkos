import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Download } from 'lucide-react';

/**
 * EmailAttachments is a lightweight component that fetches attachments for a
 * given email from the `email_attachments` table and lists them. Each
 * attachment can be downloaded via its `file_url` stored in Supabase.
 */
interface EmailAttachmentsProps {
  emailId: string;
}

interface Attachment {
  id: string;
  filename: string;
  file_url: string | null;
  content_type: string | null;
  size_bytes: number | null;
}

const EmailAttachments: React.FC<EmailAttachmentsProps> = ({ emailId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAttachments = async () => {
      if (!emailId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('email_attachments')
        .select('*')
        .eq('email_id', emailId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setAttachments(data as Attachment[]);
      }
      setLoading(false);
    };
    fetchAttachments();
  }, [emailId]);

  if (loading) {
    return <p>Lade Anhnge…</p>;
  }

  if (attachments.length === 0) {
    return <p>Keine Anhnge vorhanden.</p>;
  }

  return (
    <div className="mt-4">
      <h4 className="font-semibold mb-2 flex items-center gap-1">
        <Download className="w-4 h-4" /> Anhnge
      </h4>
      <ul className="space-y-1">
        {attachments.map((att) => (
          <li key={att.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm truncate" title={att.filename}>{att.filename}</span>
            {att.file_url ? (
              <a
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                Download
              </a>
            ) : (
              <span className="text-xs text-gray-400">keine Datei</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EmailAttachments;
