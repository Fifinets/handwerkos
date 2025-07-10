import { supabase } from "@/integrations/supabase/client";

// Google Calendar API Integration mit Supabase Secrets

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  colorId?: string;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  selected?: boolean;
  accessRole?: string;
}

class GoogleCalendarAPI {
  private accessToken: string | null = null;
  private clientId: string = '';

  constructor() {
    this.accessToken = localStorage.getItem('google_calendar_token');
  }

  async setClientId() {
    try {
      // Get Google Client ID from Supabase Edge Function (secure way)
      const { data, error } = await supabase.functions.invoke('get-google-client-id');
      
      if (error) {
        console.error('Failed to get Google Client ID:', error);
        throw new Error('Google Client ID nicht konfiguriert');
      }
      
      this.clientId = data.clientId;
    } catch (error) {
      console.error('Error getting client ID:', error);
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      console.log('Starting Google authentication...');
      
      // Ensure client ID is set
      if (!this.clientId) {
        await this.setClientId();
      }
      
      // Load Google APIs
      await this.loadGoogleAPI();
      
      console.log('Google API loaded, initializing auth...');
      
      // Initialize gapi
      return new Promise((resolve, reject) => {
        window.gapi.load('auth2', async () => {
          try {
            await window.gapi.auth2.init({
              client_id: this.clientId,
              scope: 'https://www.googleapis.com/auth/calendar.readonly'
            });

            const authInstance = window.gapi.auth2.getAuthInstance();
            const user = await authInstance.signIn();
            
            this.accessToken = user.getAuthResponse().access_token;
            localStorage.setItem('google_calendar_token', this.accessToken);
            
            console.log('Google authentication successful');
            resolve(true);
          } catch (error) {
            console.error('Auth initialization failed:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Google authentication failed:', error);
      return false;
    }
  }

  async loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client:auth2', resolve);
      };
      script.onerror = (error) => {
        console.error('Failed to load Google API script:', error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  async getCalendars(): Promise<GoogleCalendar[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('Fetching calendars from Google API...');
      
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Calendar API response:', response.status, response.statusText);
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Calendars loaded:', data.items?.length || 0);
      
      return (data.items || []).map((calendar: any) => ({
        id: calendar.id,
        summary: calendar.summary,
        description: calendar.description,
        backgroundColor: calendar.backgroundColor || '#1976D2',
        selected: false,
        accessRole: calendar.accessRole
      }));
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      throw error;
    }
  }

  async getEvents(calendarIds: string[], timeMin?: Date, timeMax?: Date): Promise<GoogleCalendarEvent[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const allEvents: GoogleCalendarEvent[] = [];

    try {
      for (const calendarId of calendarIds) {
        const params = new URLSearchParams({
          timeMin: timeMin?.toISOString() || new Date().toISOString(),
          timeMax: timeMax?.toISOString() || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100'
        });

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch events for calendar ${calendarId}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        allEvents.push(...(data.items || []));
      }

      return allEvents;
    } catch (error) {
      console.error('Failed to fetch events:', error);
      throw error;
    }
  }

  disconnect() {
    this.accessToken = null;
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('google_calendar_selected');
    
    if (window.gapi && window.gapi.auth2) {
      const authInstance = window.gapi.auth2.getAuthInstance();
      if (authInstance) {
        authInstance.signOut();
      }
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

// Declare global gapi type
declare global {
  interface Window {
    gapi: any;
  }
}

export const googleCalendarAPI = new GoogleCalendarAPI();
export type { GoogleCalendar, GoogleCalendarEvent };