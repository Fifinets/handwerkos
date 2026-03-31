import { NOTIFICATION_CATEGORIES, NotificationType } from '@/services/notificationService';

interface NotificationFiltersProps {
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  counts?: Record<string, number>;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function NotificationFilters({ activeCategory, onCategoryChange, counts }: NotificationFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 px-1 py-2">
      <button
        onClick={() => onCategoryChange(null)}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          activeCategory === null
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-muted-foreground hover:bg-muted'
        }`}
      >
        Alle
        {counts?.all ? ` (${counts.all})` : ''}
      </button>
      {Object.entries(NOTIFICATION_CATEGORIES).map(([key, cat]) => {
        const count = counts?.[key] || 0;
        return (
          <button
            key={key}
            onClick={() => onCategoryChange(key === activeCategory ? null : key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {cat.label}
            {count > 0 ? ` (${count})` : ''}
          </button>
        );
      })}
    </div>
  );
}

export function getCategoryForType(type: NotificationType): string {
  for (const [key, cat] of Object.entries(NOTIFICATION_CATEGORIES)) {
    if ((cat.types as string[]).includes(type)) return key;
  }
  return 'system';
}

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
}
