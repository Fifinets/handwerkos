// src/components/notifications/NotificationBell.tsx
import { useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useNotificationStats, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotificationHooks';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { getPriorityColor } from './NotificationFilters';

const CATEGORY_LABELS: Record<string, string> = {
  capacity: 'Kapazität',
  deadlines: 'Termine',
  team: 'Team',
};

const CATEGORY_ICONS: Record<string, string> = {
  capacity: '📊',
  deadlines: '📅',
  team: '👥',
};

interface NotificationItem {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const { data: statsData } = useNotificationStats({ refetchInterval: 60_000 });
  const { data: notifData, refetch } = useNotifications(
    { page: 1, limit: 30 },
    { archived: false },
    { refetchInterval: 60_000 } // Poll every 60 seconds
  );

  const markAllRead = useMarkAllNotificationsRead();

  const stats = statsData?.data;
  const notifications: NotificationItem[] = notifData?.data || [];
  const unreadCount = stats?.unread_notifications || 0;

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeTab);

  const markReadMutation = useMarkNotificationRead();

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id, { onSuccess: () => refetch() });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        toast({ title: 'Alle als gelesen markiert' });
        refetch();
      },
    });
  };

  const handleClick = (notif: NotificationItem) => {
    if (!notif.read) handleMarkRead(notif.id);
    if (notif.action_url) {
      navigate(notif.action_url);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm text-slate-900">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Alle gelesen
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-none border-b bg-transparent h-9 p-0">
            <TabsTrigger value="all" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none">
              Alle
            </TabsTrigger>
            {['capacity', 'deadlines', 'team'].map(cat => (
              <TabsTrigger key={cat} value={cat} className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none">
                {CATEGORY_LABELS[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="max-h-[400px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Keine Benachrichtigungen
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm flex-shrink-0 mt-0.5">{CATEGORY_ICONS[notif.category] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-900 truncate">{notif.title}</span>
                          {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getPriorityColor(notif.priority)}`}>
                            {notif.priority}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: de })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
