/**
 * Global Window interface extensions for HandwerkOS
 * Provides type safety for properties attached to the window object.
 */

declare global {
  interface Window {
    /** Opens the cookie consent settings banner */
    openCookieSettings?: () => void;
    /** Temporary storage for invitation data during auth flow */
    invitationData?: {
      invite_token: string;
      email: string;
      company_id: string;
      employee_data?: {
        firstName?: string;
        lastName?: string;
      };
    };
    /** Debug helper for creating test employees */
    createTestEmployees?: () => Promise<unknown>;
  }
}

export {};
