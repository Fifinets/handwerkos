import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  MapPin, 
  Navigation,
  CheckCircle,
  AlertCircle,
  Play,
  Square
} from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import mapboxgl from 'mapbox-gl';
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Project {
  id: string;
  name: string;
  location: string;
}

interface LocationBasedTimeTrackingProps {
  employeeId: string;
}

const LocationBasedTimeTracking: React.FC<LocationBasedTimeTrackingProps> = ({ employeeId }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [assignedProject, setAssignedProject] = useState<Project | null>(null);
  const [isInRange, setIsInRange] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTimeEntry, setActiveTimeEntry] = useState<any>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const RADIUS_METERS = 100; // 100 Meter Radius

  useEffect(() => {
    checkLocationPermission();
    fetchAssignedProject();
    checkActiveTimeEntry();
  }, [employeeId]);

  useEffect(() => {
    if (currentPosition && assignedProject && mapContainer.current && !map.current) {
      initializeMap();
    }
  }, [currentPosition, assignedProject]);

  const checkLocationPermission = async () => {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location === 'granted') {
        setPermissionGranted(true);
        getCurrentLocation();
      } else {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location === 'granted') {
          setPermissionGranted(true);
          getCurrentLocation();
        } else {
          toast.error('GPS-Berechtigung erforderlich für die Arbeitszeit-Erfassung');
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Location permission error:', error);
      toast.error('Fehler beim Zugriff auf GPS');
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      const newPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      setCurrentPosition(newPosition);
      
      if (assignedProject) {
        checkIfInRange(newPosition);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Standort konnte nicht ermittelt werden');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssignedProject = async () => {
    try {
      // Hole das aktuelle Employee-Record
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', employeeId)
        .single();

      if (!employee) return;

      // Hole die aktuelle Projektzuweisung
      const { data: assignment } = await supabase
        .from('project_assignments')
        .select(`
          project_id,
          projects (
            id,
            name,
            location
          )
        `)
        .eq('employee_id', employee.id)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
        .single();

      if (assignment?.projects) {
        setAssignedProject({
          id: assignment.projects.id,
          name: assignment.projects.name,
          location: assignment.projects.location || ''
        });
      }
    } catch (error) {
      console.error('Error fetching assigned project:', error);
      toast.error('Fehler beim Laden der Projektzuweisung');
    }
  };

  const checkActiveTimeEntry = async () => {
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', employeeId)
        .single();

      if (!employee) return;

      const { data: activeEntry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('status', 'aktiv')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      setActiveTimeEntry(activeEntry);
    } catch (error) {
      // Kein aktiver Eintrag gefunden ist normal
    }
  };

  const checkIfInRange = (position: { lat: number; lng: number }) => {
    if (!assignedProject?.location) return;

    // Vereinfachte Entfernungsberechnung (für Demo)
    // In der Realität würde man eine präzisere Geocoding-API verwenden
    const projectCoords = parseLocationString(assignedProject.location);
    if (!projectCoords) return;

    const distance = calculateDistance(
      position.lat,
      position.lng,
      projectCoords.lat,
      projectCoords.lng
    );

    setIsInRange(distance <= RADIUS_METERS);
  };

  const parseLocationString = (location: string) => {
    // Vereinfachte Koordinaten-Extraktion
    // In der Realität würde man Geocoding verwenden
    const matches = location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (matches) {
      return {
        lat: parseFloat(matches[1]),
        lng: parseFloat(matches[2])
      };
    }
    
    // Fallback für Adressen ohne Koordinaten
    // Hier würde normalerweise Geocoding stattfinden
    return {
      lat: 52.5200, // Berlin als Fallback
      lng: 13.4050
    };
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Erdradius in Metern
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Entfernung in Metern
  };

  const initializeMap = () => {
    if (!mapContainer.current || !currentPosition || !assignedProject) return;

    // Temporärer Mapbox Token - User muss eigenen Token eingeben
    mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN_HERE';
    
    const projectCoords = parseLocationString(assignedProject.location);
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [currentPosition.lng, currentPosition.lat],
      zoom: 16
    });

    // Marker für aktueller Standort
    new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat([currentPosition.lng, currentPosition.lat])
      .setPopup(new mapboxgl.Popup().setText('Ihr Standort'))
      .addTo(map.current);

    // Marker für Projektstandort
    if (projectCoords) {
      new mapboxgl.Marker({ color: '#EF4444' })
        .setLngLat([projectCoords.lng, projectCoords.lat])
        .setPopup(new mapboxgl.Popup().setText(assignedProject.name))
        .addTo(map.current);

      // Radius-Kreis um Projektstandort
      map.current.on('load', () => {
        if (!map.current) return;

        map.current.addSource('radius', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [projectCoords.lng, projectCoords.lat]
            }
          }
        });

        map.current.addLayer({
          id: 'radius',
          type: 'circle',
          source: 'radius',
          paint: {
            'circle-radius': {
              stops: [
                [0, 0],
                [20, metersToPixelsAtMaxZoom(RADIUS_METERS, projectCoords.lat)]
              ],
              base: 2
            },
            'circle-color': isInRange ? '#10B981' : '#EF4444',
            'circle-opacity': 0.2,
            'circle-stroke-color': isInRange ? '#10B981' : '#EF4444',
            'circle-stroke-width': 2
          }
        });
      });
    }
  };

  const metersToPixelsAtMaxZoom = (meters: number, latitude: number) => {
    return meters / 0.075 / Math.cos(latitude * Math.PI / 180);
  };

  const handleStartWork = async () => {
    if (!isInRange) {
      toast.error('Sie befinden sich nicht im Arbeitsbereich');
      return;
    }

    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', employeeId)
        .single();

      if (!employee) {
        toast.error('Mitarbeiterdaten nicht gefunden');
        return;
      }

      const { error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: employee.id,
          project_id: assignedProject?.id,
          start_time: new Date().toISOString(),
          start_location_lat: currentPosition?.lat,
          start_location_lng: currentPosition?.lng,
          start_location_address: assignedProject?.location,
          status: 'aktiv'
        });

      if (error) throw error;

      toast.success('Arbeitsbeginn erfasst');
      checkActiveTimeEntry();
    } catch (error) {
      console.error('Error starting work:', error);
      toast.error('Fehler beim Erfassen des Arbeitsbeginns');
    }
  };

  const handleEndWork = async () => {
    if (!activeTimeEntry) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: new Date().toISOString(),
          end_location_lat: currentPosition?.lat,
          end_location_lng: currentPosition?.lng,
          end_location_address: assignedProject?.location,
          status: 'beendet'
        })
        .eq('id', activeTimeEntry.id);

      if (error) throw error;

      toast.success('Arbeitsende erfasst');
      setActiveTimeEntry(null);
    } catch (error) {
      console.error('Error ending work:', error);
      toast.error('Fehler beim Erfassen des Arbeitsendes');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">GPS wird ermittelt...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!permissionGranted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            GPS-Berechtigung erforderlich
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Für die Arbeitszeit-Erfassung ist der Zugriff auf Ihren Standort erforderlich.
          </p>
          <Button onClick={checkLocationPermission}>
            GPS-Berechtigung erteilen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Projekt Info */}
      {assignedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Zugewiesenes Projekt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{assignedProject.name}</p>
                <p className="text-sm text-muted-foreground">{assignedProject.location}</p>
              </div>
              <Badge variant={isInRange ? "default" : "destructive"}>
                {isInRange ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Im Arbeitsbereich
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Außerhalb
                  </>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Karte */}
      {currentPosition && (
        <Card>
          <CardHeader>
            <CardTitle>Standort & Arbeitsbereich</CardTitle>
            <CardDescription>
              Blau = Ihr Standort, Rot = Projektstandort, Kreis = Arbeitsbereich ({RADIUS_METERS}m)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={mapContainer} className="h-64 rounded-lg" />
          </CardContent>
        </Card>
      )}

      {/* Zeiterfassung */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Arbeitszeit erfassen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button 
              onClick={handleStartWork}
              disabled={!isInRange || !!activeTimeEntry}
              size="lg"
              className="h-16"
            >
              <Play className="h-5 w-5 mr-2" />
              Arbeitsbeginn
            </Button>
            <Button 
              onClick={handleEndWork}
              disabled={!activeTimeEntry}
              variant="outline"
              size="lg"
              className="h-16"
            >
              <Square className="h-5 w-5 mr-2" />
              Arbeitsende
            </Button>
          </div>
          
          {!isInRange && !activeTimeEntry && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Sie müssen sich im Arbeitsbereich befinden, um die Arbeitszeit zu erfassen.
              </p>
            </div>
          )}

          {activeTimeEntry && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                Arbeitszeit läuft seit {new Date(activeTimeEntry.start_time).toLocaleTimeString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationBasedTimeTracking;