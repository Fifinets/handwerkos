// Status badge for delivery notes with color coding

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type DeliveryNoteStatus,
  DELIVERY_NOTE_STATUS_LABELS,
  DELIVERY_NOTE_STATUS_COLORS,
} from '@/types';

interface DeliveryNoteStatusBadgeProps {
  status: DeliveryNoteStatus;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function DeliveryNoteStatusBadge({
  status,
  className,
}: DeliveryNoteStatusBadgeProps) {
  const label = DELIVERY_NOTE_STATUS_LABELS[status];
  const color = DELIVERY_NOTE_STATUS_COLORS[status];
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
