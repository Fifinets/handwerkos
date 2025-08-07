import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText, Paperclip, AlertTriangle } from 'lucide-react';
import { parseEmailContent, shouldDisplayAsHtml, sanitizeHtmlContent, getPreferredContentType } from '@/utils/emailMimeParser';
import { cleanEmailContent } from '@/utils/emailContentCleaner';
import { cleanContentForUtf8, validateEmailContent } from '@/utils/emailEncoding';

interface EmailContentRendererProps {
  content: string;
  className?: string;
}

/**
 * Advanced email content renderer with proper MIME parsing and HTML/text switching
 */
export function EmailContentRenderer({ content, className = '' }: EmailContentRendererProps) {
  const [displayMode, setDisplayMode] = useState<'html' | 'text'>(getPreferredContentType());
  const [showRawContent, setShowRawContent] = useState(false);

  // Parse and validate email content
  const { parsedContent, validation, processedContent } = useMemo(() => {
    const parsed = parseEmailContent(content);
    const validation = validateEmailContent(content);
    
    let processedContent = '';
    const shouldShowHtml = shouldDisplayAsHtml(parsed) && displayMode === 'html';
    
    if (shouldShowHtml && parsed.htmlContent) {
      // Process HTML content
      processedContent = sanitizeHtmlContent(
        cleanEmailContent(
          cleanContentForUtf8(parsed.htmlContent),
          {
            removeDecorations: true,
            fixImages: true,
            preserveFormatting: true,
            addPhoneLinks: true
          }
        )
      );
    } else if (parsed.plainTextContent) {
      // Process plain text content
      processedContent = cleanEmailContent(
        cleanContentForUtf8(parsed.plainTextContent),
        {
          removeDecorations: true,
          fixImages: false,
          preserveFormatting: true,
          addPhoneLinks: true
        }
      );
    } else if (parsed.preferredContent) {
      // Fallback to preferred content
      processedContent = cleanEmailContent(
        cleanContentForUtf8(parsed.preferredContent),
        {
          removeDecorations: true,
          fixImages: true,
          preserveFormatting: true,
          addPhoneLinks: true
        }
      );
    } else {
      // Last resort - raw content cleaning
      processedContent = cleanEmailContent(
        cleanContentForUtf8(content),
        {
          removeDecorations: true,
          fixImages: true,
          preserveFormatting: true,
          addPhoneLinks: true
        }
      );
    }

    return { 
      parsedContent: parsed, 
      validation, 
      processedContent 
    };
  }, [content, displayMode]);

  // Save display preference
  React.useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('emailDisplayPreference', displayMode);
    }
  }, [displayMode]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header Controls */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          {/* Content Type Buttons */}
          {(parsedContent.htmlContent && parsedContent.plainTextContent) && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Anzeige:</span>
              <Button
                variant={displayMode === 'html' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDisplayMode('html')}
                className="h-6 px-2 text-xs"
              >
                <Eye className="w-3 h-3 mr-1" />
                HTML
              </Button>
              <Button
                variant={displayMode === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDisplayMode('text')}
                className="h-6 px-2 text-xs"
              >
                <FileText className="w-3 h-3 mr-1" />
                Text
              </Button>
            </div>
          )}

          {/* Attachments indicator */}
          {parsedContent.hasAttachments && (
            <Badge variant="secondary" className="text-xs">
              <Paperclip className="w-3 h-3 mr-1" />
              {parsedContent.attachments.length} Anhang(e)
            </Badge>
          )}

          {/* Validation warnings */}
          {!validation.isValid && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {validation.issues.length} Problem(e)
            </Badge>
          )}
        </div>

        {/* Raw content toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRawContent(!showRawContent)}
          className="h-6 px-2 text-xs"
        >
          {showRawContent ? 'Formatiert' : 'Quelltext'}
        </Button>
      </div>

      {/* Content Display */}
      {showRawContent ? (
        <div className="bg-muted p-3 rounded-md">
          <pre className="text-xs whitespace-pre-wrap break-all">
            {content}
          </pre>
        </div>
      ) : (
        <div 
          className="text-sm leading-relaxed max-w-none email-content"
          dangerouslySetInnerHTML={{ __html: processedContent }}
          style={{
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.6',
            color: '#374151'
          }}
        />
      )}

      {/* Attachments List */}
      {parsedContent.hasAttachments && (
        <div className="border-t pt-2">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Anhänge:</h4>
          <div className="space-y-1">
            {parsedContent.attachments.map((attachment, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <Paperclip className="w-3 h-3" />
                <span className="font-medium">{attachment.filename}</span>
                <Badge variant="outline" className="text-xs">
                  {attachment.contentType}
                </Badge>
                {attachment.inline && (
                  <Badge variant="secondary" className="text-xs">
                    Inline
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Info Footer */}
      <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
        <div>
          <strong>Content-Type:</strong> {parsedContent.headers.contentType || 'unbekannt'}
          {parsedContent.headers.charset && (
            <span> • <strong>Charset:</strong> {parsedContent.headers.charset.toUpperCase()}</span>
          )}
          {parsedContent.headers.multipart && (
            <span> • <strong>Multipart</strong></span>
          )}
        </div>
        
        {/* Validation Issues */}
        {!validation.isValid && (
          <div className="text-amber-600">
            <strong>Probleme gefunden:</strong>
            <ul className="list-disc list-inside ml-2 mt-1">
              {validation.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
            {validation.suggestions.length > 0 && (
              <div className="mt-1">
                <strong>Empfehlungen:</strong>
                <ul className="list-disc list-inside ml-2">
                  {validation.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}