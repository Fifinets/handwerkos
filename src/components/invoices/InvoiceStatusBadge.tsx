// Status badge for invoices with color coding

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type InvoiceStatus,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
} from '@/types';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
};

export function InvoiceStatusBadge({
  status,
  className,
}: InvoiceStatusBadgeProps) {
  const label = INVOICE_STATUS_LABELS[status];
  const color = INVOICE_STATUS_COLORS[status];
  const colorClass = statusColorMap[color] || statusColorMap.gray;

  return (
    <Badge
      variant="outline"
      className={cn(colorClass, className)}
    >
      {label}
    </Badge>
  );
}
