import { Badge } from '@/components/ui/badge';
import { OfferStatus, OFFER_STATUS_LABELS } from '@/types/offer';
import {
  FileEdit,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Ban
} from 'lucide-react';

interface OfferStatusBadgeProps {
  status: OfferStatus;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const STATUS_CONFIG: Record<OfferStatus, {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  icon: React.ReactNode;
}> = {
  draft: {
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    icon: <FileEdit className="h-3 w-3" />,
  },
  sent: {
    variant: 'default',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    icon: <Send className="h-3 w-3" />,
  },
  accepted: {
    variant: 'default',
    className: 'bg-green-100 text-green-700 hover:bg-green-100',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 hover:bg-red-100',
    icon: <XCircle className="h-3 w-3" />,
  },
  expired: {
    variant: 'outline',
    className: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    icon: <Clock className="h-3 w-3" />,
  },
  cancelled: {
    variant: 'outline',
    className: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
    icon: <Ban className="h-3 w-3" />,
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  default: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

export function OfferStatusBadge({
  status,
  showIcon = true,
  size = 'default'
}: OfferStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const label = OFFER_STATUS_LABELS[status];

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${SIZE_CLASSES[size]} font-medium`}
    >
      {showIcon && (
        <span className="mr-1.5">{config.icon}</span>
      )}
      {label}
    </Badge>
  );
}

export default OfferStatusBadge;
