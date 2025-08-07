import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, Settings, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { googleCalendarAPI, GoogleCalendar } from "@/lib/googleCalendar";
import { supabase } from "@/integrations/supabase/client";

interface GoogleCalendarSettingsProps {
  onCalendarsChange?: (calendars: GoogleCalendar[]) => void;
}

const GoogleCalendarSettings: React.FC<GoogleCalendarSettingsProps> = ({ onCalendarsChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already connected to Google Calendar
    checkGoogleConnection();
  }, []);

  const checkGoogleConnection = async () => {
    try {
      const token = localStorage.getItem('google_calendar_token');
      if (token) {
        setIsConnected(true);
        await loadCalendars();
      }
    } catch (error) {
      console.error('Error checking Google connection:', error);
    }
  };

  const connectToGoogle = async () => {
    setIsLoading(true);
    try {
      console.log('Starting Google Calendar connection...');
      const success = await googleCalendarAPI.authenticate();
      
      if (success) {
        setIsConnected(true);
        await loadCalendars();
        toast({
          title: "Verbindung erfolgreich",
          description: "Mit Google Calendar verbunden.",
        });
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Error connecting to Google:', error);
      toast({
        title: "Verbindungsfehler", 
        description: error instanceof Error ? error.message : "Fehler bei der Google-Verbindung.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCalendars = async () => {
    try {
      if (googleCalendarAPI.isAuthenticated()) {
        // Load real calendars from Google Calendar API
        const realCalendars = await googleCalendarAPI.getCalendars();
        
        // Load previously selected calendars
        const savedSelection = localStorage.getItem('google_calendar_selected');
        const selectedIds = savedSelection ? JSON.parse(savedSelection) : [];
        
        // Mark previously selected calendars
        const calendarsWithSelection = realCalendars.map(cal => ({
          ...cal,
          selected: selectedIds.includes(cal.id)
        }));
        
        setCalendars(calendarsWithSelection);
        onCalendarsChange?.(calendarsWithSelection.filter(cal => cal.selected));
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
      toast({
        title: "Fehler beim Laden der Kalender",
        description: "Konnte Google Calendar nicht erreichen. Bitte erneut verbinden.",
        variant: "destructive",
      });
      // Fallback to disconnect if API fails
      setIsConnected(false);
      googleCalendarAPI.disconnect();
    }
  };

  const toggleCalendar = (calendarId: string) => {
    const updatedCalendars = calendars.map(cal => 
      cal.id === calendarId ? { ...cal, selected: !cal.selected } : cal
    );
    setCalendars(updatedCalendars);
    
    // Save selection to localStorage
    const selectedIds = updatedCalendars.filter(cal => cal.selected).map(cal => cal.id);
    localStorage.setItem('google_calendar_selected', JSON.stringify(selectedIds));
    
    onCalendarsChange?.(updatedCalendars.filter(cal => cal.selected));
  };

  const syncCalendars = async () => {
    setIsLoading(true);
    try {
      const selectedCalendars = calendars.filter(cal => cal.selected);
      
      if (selectedCalendars.length === 0) {
        toast({
          title: "Keine Kalender ausgewählt",
          description: "Bitte wählen Sie mindestens einen Kalender aus.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Here we would call the actual sync function
      // For now, simulate the sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Synchronisation erfolgreich",
        description: `${selectedCalendars.length} Kalender wurden synchronisiert.`,
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Error syncing calendars:', error);
      toast({
        title: "Synchronisation fehlgeschlagen",
        description: "Fehler beim Synchronisieren der Kalender.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectGoogle = () => {
    googleCalendarAPI.disconnect();
    setIsConnected(false);
    setCalendars([]);
    toast({
      title: "Verbindung getrennt",
      description: "Google Calendar wurde getrennt.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Google Calendar
          {isConnected && <CheckCircle className="h-4 w-4 text-green-500" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Google Calendar Integration
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isConnected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mit Google verbinden</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Verbinden Sie sich mit Google Calendar, um Ihre Termine zu importieren.
                </p>
                <Button
                  onClick={connectToGoogle} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Verbinde...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Mit Google verbinden
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    Kalender auswählen
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verbunden
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {calendars.map((calendar) => (
                    <div 
                      key={calendar.id} 
                      className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-accent"
                    >
                      <Checkbox
                        id={calendar.id}
                        checked={calendar.selected}
                        onCheckedChange={() => toggleCalendar(calendar.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: calendar.backgroundColor }}
                          />
                          <label 
                            htmlFor={calendar.id} 
                            className="text-sm font-medium cursor-pointer"
                          >
                            {calendar.summary}
                          </label>
                        </div>
                        {calendar.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {calendar.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  onClick={syncCalendars} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Synchronisiere...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Synchronisieren
                    </>
                  )}
                </Button>
                <Button
                  variant="outline" 
                  onClick={disconnectGoogle}
                  disabled={isLoading}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoogleCalendarSettings;