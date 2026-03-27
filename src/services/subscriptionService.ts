import { supabase } from '@/integrations/supabase/client';
import { apiCall, ApiError, API_ERROR_CODES } from '@/utils/api';
import type {
  SubscriptionPlan,
  CompanySubscription,
  OfferPaymentStatusResponse,
  CheckoutSessionResponse,
  PortalSessionResponse,
  PaymentLinkResponse,
} from '@/types/subscription';

export class SubscriptionService {

  // ============================================================================
  // PLANS
  // ============================================================================

  static async getPlans(): Promise<SubscriptionPlan[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Get subscription plans');
  }

  // ============================================================================
  // SUBSCRIPTION STATUS
  // ============================================================================

  static async getSubscription(): Promise<CompanySubscription> {
    return apiCall(async () => {
      const companyId = await this.getCompanyId();

      // @ts-ignore
      const { data, error } = await supabase.rpc('get_company_subscription', {
        p_company_id: companyId,
      });

      if (error) throw error;
      return data as CompanySubscription;
    }, 'Get company subscription');
  }

  static async hasFeature(feature: string): Promise<boolean> {
    try {
      const sub = await this.getSubscription();
      return sub.features.includes(feature);
    } catch {
      return false;
    }
  }

  static async isActive(): Promise<boolean> {
    try {
      const sub = await this.getSubscription();
      return sub.is_active;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // CHECKOUT & PORTAL
  // ============================================================================

  static async createCheckout(priceId: string): Promise<CheckoutSessionResponse> {
    return apiCall(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');
      }

      const response = await supabase.functions.invoke('create-checkout', {
        body: {
          price_id: priceId,
          success_url: `${window.location.origin}/manager2?subscription=success`,
          cancel_url: `${window.location.origin}/manager2?subscription=cancelled`,
        },
      });

      if (response.error) throw response.error;
      return response.data as CheckoutSessionResponse;
    }, 'Create checkout session');
  }

  static async createPortalSession(): Promise<PortalSessionResponse> {
    return apiCall(async () => {
      const response = await supabase.functions.invoke('create-portal-session', {
        body: {
          return_url: `${window.location.origin}/manager2?tab=billing`,
        },
      });

      if (response.error) throw response.error;
      return response.data as PortalSessionResponse;
    }, 'Create portal session');
  }

  // ============================================================================
  // OFFER PAYMENTS
  // ============================================================================

  static async createPaymentLink(offerId: string): Promise<PaymentLinkResponse> {
    return apiCall(async () => {
      const response = await supabase.functions.invoke('create-payment-link', {
        body: { offer_id: offerId },
      });

      if (response.error) throw response.error;
      return response.data as PaymentLinkResponse;
    }, 'Create payment link');
  }

  static async getOfferPaymentStatus(offerId: string): Promise<OfferPaymentStatusResponse> {
    return apiCall(async () => {
      // @ts-ignore
      const { data, error } = await supabase.rpc('get_offer_payment_status', {
        p_offer_id: offerId,
      });

      if (error) throw error;
      return data as OfferPaymentStatusResponse;
    }, 'Get offer payment status');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private static async getCompanyId(): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.user.id)
      .single();

    if (profile?.company_id) return profile.company_id;

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.user.id)
      .single();

    if (employee?.company_id) return employee.company_id;

    return '00000000-0000-0000-0000-000000000000';
  }
}
