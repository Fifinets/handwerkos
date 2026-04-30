import { CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ApprovalCardProps {
  taskId: string;
  preview: Record<string, unknown>;
  agentMessage?: string;
  alreadyApproved?: boolean;
  onApprove: (taskId: string) => void;
  onNavigateToOffers: () => void;
}

function formatCurrency(value: unknown): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function ApprovalCard({
  taskId,
  preview,
  agentMessage,
  alreadyApproved = false,
  onApprove,
  onNavigateToOffers,
}: ApprovalCardProps) {
  const customer = (preview.customer ?? preview.customerName) as string | undefined;
  const projectName = preview.projectName as string | undefined;
  const gesamtNetto = formatCurrency(preview.gesamtNetto);
  const positionsAnzahl = preview.positionsAnzahl as number | undefined;

  return (
    <Card className="border-violet-200 bg-violet-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Angebot zur Freigabe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          {customer && (
            <div>
              <span className="text-muted-foreground">Kunde: </span>
              <span className="font-medium">{customer}</span>
            </div>
          )}
          {projectName && (
            <div>
              <span className="text-muted-foreground">Projekt: </span>
              <span className="font-medium">{projectName}</span>
            </div>
          )}
          {typeof positionsAnzahl === 'number' && (
            <div>
              <span className="text-muted-foreground">Positionen: </span>
              <span className="font-medium">{positionsAnzahl}</span>
            </div>
          )}
          {gesamtNetto && (
            <div>
              <span className="text-muted-foreground">Gesamt netto: </span>
              <span className="font-medium">{gesamtNetto}</span>
            </div>
          )}
        </div>

        {agentMessage && (
          <p className="text-sm text-muted-foreground italic">{agentMessage}</p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => onApprove(taskId)}
            disabled={alreadyApproved}
            className="flex-1"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {alreadyApproved ? 'Freigegeben' : 'Freigeben'}
          </Button>
          <Button variant="outline" onClick={onNavigateToOffers}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Ansehen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
