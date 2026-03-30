// Notification hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { notificationService } from '@/services/notificationService';
import type { PaginationQuery } from '@/types';
import { QUERY_KEYS } from './useQueryKeys';

// ============================================
// NOTIFICATION HOOKS
// ============================================

/**
 * Get notifications with pagination and filtering
 */
export const useNotifications = (
  pagination?: PaginationQuery,
  filters?: any,
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, pagination, filters],
    queryFn: () => notificationService.getNotifications(pagination, filters),
    staleTime: 30 * 1000, // 30 seconds (fresh for notifications)
    ...options,
  });
};

/**
 * Get notification statistics
 */
export const useNotificationStats = (
  options?: UseQueryOptions<any, Error>
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATION_STATS],
    queryFn: () => notificationService.getNotificationStats(),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
};

/**
 * Create a new notification
 */
export const useCreateNotification = (
  options?: UseMutationOptions<any, Error, any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => notificationService.createNotification(data),
    onSuccess: (newNotification, variables) => {
      // Invalidate notifications queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });

      toast({
        title: 'Benachrichtigung erstellt',
        description: 'Die Benachrichtigung wurde erfolgreich erstellt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message || 'Die Benachrichtigung konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Mark notification as read
 */
export const useMarkNotificationRead = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });
    },
    ...options,
  });
};

/**
 * Mark all notifications as read
 */
export const useMarkAllNotificationsRead = (
  options?: UseMutationOptions<void, Error, void>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });

      toast({
        title: 'Alle als gelesen markiert',
        description: 'Alle Benachrichtigungen wurden als gelesen markiert.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: 'Die Benachrichtigungen konnten nicht aktualisiert werden.',
        variant: 'destructive',
      });
    },
    ...options,
  });
};

/**
 * Archive notification
 */
export const useArchiveNotification = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.archiveNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NOTIFICATION_STATS] });
    },
    ...options,
  });
};
