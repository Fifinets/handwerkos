import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubscriptionService } from '@/services/subscriptionService';
import type {
  SubscriptionPlan,
  CompanySubscription,
  PlanSlug,
  UsageStats,
} from '@/types/subscription';
import { PLAN_FEATURES } from '@/types/subscription';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const subscriptionKeys = {
  all: ['subscription'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  status: () => [...subscriptionKeys.all, 'status'] as const,
  usage: () => [...subscriptionKeys.all, 'usage'] as const,
  offerPayment: (offerId: string) =>
    [...subscriptionKeys.all, 'offer-payment', offerId] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: subscriptionKeys.plans(),
    queryFn: () => SubscriptionService.getPlans(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSubscription() {
  return useQuery<CompanySubscription>({
    queryKey: subscriptionKeys.status(),
    queryFn: () => SubscriptionService.getSubscription(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useUsageStats() {
  return useQuery<UsageStats>({
    queryKey: subscriptionKeys.usage(),
    queryFn: () => SubscriptionService.getUsageStats(),
    staleTime: 60 * 1000, // 1 min cache
  });
}

export function useFeatureAccess(feature: string): {
  hasAccess: boolean;
  isLoading: boolean;
  planSlug: string;
  requiredPlan: PlanSlug | null;
} {
  const { data: subscription, isLoading } = useSubscription();

  const hasAccess = subscription?.features?.includes(feature) ?? false;

  let requiredPlan: PlanSlug | null = null;
  if (!hasAccess) {
    for (const slug of ['basic', 'pro', 'enterprise'] as PlanSlug[]) {
      if (PLAN_FEATURES[slug]?.includes(feature)) {
        requiredPlan = slug;
        break;
      }
    }
  }

  return {
    hasAccess,
    isLoading,
    planSlug: subscription?.plan_slug || 'free',
    requiredPlan,
  };
}

export function useIsSubscribed(): {
  isSubscribed: boolean;
  isTrialing: boolean;
  isLoading: boolean;
  daysRemaining: number | null;
} {
  const { data: subscription, isLoading } = useSubscription();

  const isSubscribed = subscription?.is_active ?? false;
  const isTrialing = subscription?.is_trialing ?? false;

  let daysRemaining: number | null = null;
  if (isTrialing && subscription?.trial_end) {
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    daysRemaining = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  return { isSubscribed, isTrialing, isLoading, daysRemaining };
}

// ============================================================================
// MUTATIONS
// ============================================================================

export function useCheckout() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (priceId: string) => {
      const result = await SubscriptionService.createCheckout(priceId);

      // If the backend updated the subscription directly (plan switch),
      // invalidate cache instead of redirecting to checkout
      if (result.updated) {
        await queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
        return result;
      }

      // New subscription — redirect to Stripe Checkout
      window.location.href = result.url;
      return result;
    },
    onSuccess: (result) => {
      if (result.updated) {
        toast({
          title: 'Plan gewechselt',
          description: 'Ihr Abo wurde erfolgreich aktualisiert.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Checkout konnte nicht gestartet werden.',
        variant: 'destructive',
      });
    },
  });
}

export function usePortalSession() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const result = await SubscriptionService.createPortalSession();
      window.location.href = result.url;
      return result;
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Portal konnte nicht geoeffnet werden.',
        variant: 'destructive',
      });
    },
  });
}

export function useCreatePaymentLink() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (offerId: string) =>
      SubscriptionService.createPaymentLink(offerId),
    onSuccess: (data, offerId) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.offerPayment(offerId),
      });
      toast({
        title: 'Zahlungslink erstellt',
        description: 'Der Kunde kann jetzt ueber den Link bezahlen.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Zahlungslink konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
  });
}

export function useOfferPaymentStatus(offerId: string | undefined) {
  return useQuery({
    queryKey: subscriptionKeys.offerPayment(offerId || ''),
    queryFn: () => SubscriptionService.getOfferPaymentStatus(offerId!),
    enabled: !!offerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
