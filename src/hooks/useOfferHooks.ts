// Offer/Quote hooks extracted from useApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { OfferService } from '@/services/offerService';
import { fetchOfferTemplates } from '@/services/aiOfferService';
import type { PaginationQuery, PaginationResponse } from '@/types';
import type {
  Offer,
  OfferCreate,
  OfferUpdate,
  OfferItem,
  OfferItemCreate,
  OfferItemUpdate,
  OfferTarget,
  OfferTargetUpdate,
  OfferWithRelations,
  OfferFilter,
} from '@/types/offer';
import { QUERY_KEYS, UseApiQueryOptions, UseApiMutationOptions } from './useQueryKeys';

// ==========================================
// OFFER HOOKS
// ==========================================

export const useOffers = (
  pagination?: PaginationQuery,
  filters?: OfferFilter,
  options?: UseApiQueryOptions<PaginationResponse<Offer>>
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.offers, pagination, filters],
    queryFn: () => OfferService.getOffers(pagination, filters),
    ...options,
  });
};

export const useOffer = (id: string, options?: UseApiQueryOptions<OfferWithRelations>) => {
  return useQuery({
    queryKey: QUERY_KEYS.offer(id),
    queryFn: () => OfferService.getOffer(id),
    enabled: !!id,
    ...options,
  });
};

export const useOfferItems = (offerId: string, options?: UseApiQueryOptions<OfferItem[]>) => {
  return useQuery({
    queryKey: QUERY_KEYS.offerItems(offerId),
    queryFn: () => OfferService.getOfferItems(offerId),
    enabled: !!offerId,
    ...options,
  });
};

export const useOfferTargets = (offerId: string, options?: UseApiQueryOptions<OfferTarget | null>) => {
  return useQuery({
    queryKey: QUERY_KEYS.offerTargets(offerId),
    queryFn: () => OfferService.getOfferTargets(offerId),
    enabled: !!offerId,
    ...options,
  });
};

export const useOfferStats = (options?: UseApiQueryOptions<any>) => {
  return useQuery({
    queryKey: QUERY_KEYS.offerStats,
    queryFn: () => OfferService.getOfferStats(),
    ...options,
  });
};

export const useCreateOffer = (
  options?: UseApiMutationOptions<OfferWithRelations, {
    data: OfferCreate;
    targets?: any;
    items?: OfferItemCreate[];
  }>
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ data, targets, items }) => OfferService.createOffer(data, targets, items),
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customerOffers(offer.customer_id) });
      toast({
        title: 'Angebot erstellt',
        description: `${offer.offer_number} wurde erfolgreich erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useUpdateOffer = (
  options?: UseApiMutationOptions<Offer, { id: string; data: OfferUpdate }>
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => OfferService.updateOffer(id, data),
    onSuccess: (offer, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(id) });
      toast({
        title: 'Angebot aktualisiert',
        description: `${offer.offer_number} wurde erfolgreich aktualisiert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useDeleteOffer = (options?: UseApiMutationOptions<void, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => OfferService.deleteOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      toast({
        title: 'Angebot gelöscht',
        description: 'Das Angebot wurde erfolgreich gelöscht.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useSendOffer = (options?: UseApiMutationOptions<Offer, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => OfferService.sendOffer(id),
    onSuccess: (offer, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(id) });
      toast({
        title: 'Angebot versendet',
        description: `${offer.offer_number} wurde erfolgreich versendet.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Versenden',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useAcceptOffer = (
  options?: UseApiMutationOptions<{ offer: Offer; projectId: string }, {
    id: string;
    acceptedBy?: string;
    acceptanceNote?: string;
  }>
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, acceptedBy, acceptanceNote }) =>
      OfferService.acceptOffer(id, acceptedBy, acceptanceNote),
    onSuccess: (result, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      toast({
        title: 'Angebot angenommen',
        description: `${result.offer.offer_number} wurde angenommen. Projekt wurde erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Annehmen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useRejectOffer = (
  options?: UseApiMutationOptions<Offer, { id: string; reason?: string }>
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, reason }) => OfferService.rejectOffer(id, reason),
    onSuccess: (offer, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(id) });
      toast({
        title: 'Angebot abgelehnt',
        description: `${offer.offer_number} wurde abgelehnt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Ablehnen',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useReviseOffer = (options?: UseApiMutationOptions<Offer, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => OfferService.reviseOffer(id),
    onSuccess: (offer, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(id) });
      toast({
        title: 'Angebot zurück im Entwurf',
        description: `${offer.offer_number} kann jetzt überarbeitet und erneut versendet werden.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Überarbeiten',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useCancelOffer = (options?: UseApiMutationOptions<Offer, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => OfferService.cancelOffer(id),
    onSuccess: (offer, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(id) });
      toast({
        title: 'Angebot storniert',
        description: `${offer.offer_number} wurde storniert.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Stornieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

export const useDuplicateOffer = (options?: UseApiMutationOptions<OfferWithRelations, string>) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => OfferService.duplicateOffer(id),
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
      toast({
        title: 'Angebot dupliziert',
        description: `Kopie ${offer.offer_number} wurde erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Duplizieren',
        description: error.message,
        variant: 'destructive',
      });
    },
    ...options,
  });
};

// Offer Item Hooks
export const useAddOfferItem = (
  options?: UseApiMutationOptions<OfferItem, { offerId: string; item: OfferItemCreate }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ offerId, item }) => OfferService.addOfferItem(offerId, item),
    onSuccess: (_, { offerId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(offerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerItems(offerId) });
    },
    ...options,
  });
};

export const useUpdateOfferItem = (
  options?: UseApiMutationOptions<OfferItem, { itemId: string; offerId: string; data: OfferItemUpdate }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }) => OfferService.updateOfferItem(itemId, data),
    onSuccess: (_, { offerId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(offerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerItems(offerId) });
    },
    ...options,
  });
};

export const useDeleteOfferItem = (
  options?: UseApiMutationOptions<void, { itemId: string; offerId: string }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId }) => OfferService.deleteOfferItem(itemId),
    onSuccess: (_, { offerId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(offerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerItems(offerId) });
    },
    ...options,
  });
};

export const useSyncOfferItems = (
  options?: UseApiMutationOptions<OfferItem[], { offerId: string; items: (OfferItemCreate & { id?: string })[] }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ offerId, items }) => OfferService.syncOfferItems(offerId, items),
    onSuccess: (_, { offerId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(offerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerItems(offerId) });
    },
    ...options,
  });
};

// Offer Target Hooks
export const useUpdateOfferTargets = (
  options?: UseApiMutationOptions<OfferTarget, { offerId: string; data: OfferTargetUpdate }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ offerId, data }) => OfferService.updateOfferTargets(offerId, data),
    onSuccess: (_, { offerId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(offerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerTargets(offerId) });
    },
    ...options,
  });
};

// AI Offer Template Hooks
export const useOfferTemplates = (
  search?: string,
  category: string = 'elektro'
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.offerTemplates, search, category],
    queryFn: () => fetchOfferTemplates(search, category),
    staleTime: 10 * 60 * 1000,
  });
};
