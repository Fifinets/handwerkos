import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create a custom blue location pin icon for user
const createLocationIcon = () => {
  return L.divIcon({
    className: 'custom-location-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Create a construction site icon
const createConstructionSiteIcon = () => {
  return L.divIcon({
    className: 'construction-site-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #f97316;
        border: 3px solid white;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          color: white;
          font-weight: bold;
          font-size: 16px;
        ">🏗️</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Component to update map center when location changes
const MapUpdater: React.FC<{ location: { lat: number; lng: number } }> = ({ location }) => {
  const map = useMap();
  
  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng], map.getZoom());
    }
  }, [location, map]);
  
  return null;
};

interface ProjectSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

interface MapViewProps {
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  constructionSites?: ProjectSite[];
  onLocationUpdate?: (userLocation: { lat: number; lng: number; address: string }, nearByProjects: ProjectSite[]) => void;
  className?: string;
}

// Calculate distance between two points in meters
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const MapView: React.FC<MapViewProps> = ({ 
  constructionSites = [], 
  onLocationUpdate,
  className = "h-full w-full" 
}) => {
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    setMapReady(true);
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Use reverse geocoding to get address (simplified version)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`)
          .then(response => response.json())
          .then(data => {
            const newLocation = {
              lat: latitude,
              lng: longitude,
              address: data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            };
            
            setUserLocation(newLocation);
            
            // Check which projects are within 35m radius
            const nearByProjects = constructionSites.filter(project => {
              const distance = calculateDistance(latitude, longitude, project.lat, project.lng);
              return distance <= 35;
            });
            
            // Notify parent component about location update
            if (onLocationUpdate) {
              onLocationUpdate(newLocation, nearByProjects);
            }
          })
          .catch(() => {
            const newLocation = {
              lat: latitude,
              lng: longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            };
            
            setUserLocation(newLocation);
            
            // Check which projects are within 35m radius
            const nearByProjects = constructionSites.filter(project => {
              const distance = calculateDistance(latitude, longitude, project.lat, project.lng);
              return distance <= 35;
            });
            
            // Notify parent component about location update
            if (onLocationUpdate) {
              onLocationUpdate(newLocation, nearByProjects);
            }
          })
          .finally(() => {
            setIsLoadingLocation(false);
          });
      },
      (error) => {
        console.error('Error getting location:', error);
        // Fallback to Berlin center
        setUserLocation({
          lat: 52.520008,
          lng: 13.404954,
          address: 'Standort nicht verfügbar - Standardposition Berlin'
        });
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  if (!mapReady || isLoadingLocation) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">
            {isLoadingLocation ? 'Standort wird ermittelt...' : 'Karte wird geladen...'}
          </p>
        </div>
      </div>
    );
  }

  if (!userLocation) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 text-sm">Standort konnte nicht ermittelt werden</p>
          <button 
            onClick={getCurrentLocation}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded text-sm"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <MapContainer 
        center={[userLocation.lat, userLocation.lng]} 
        zoom={18} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* CartoDB Positron - Clean gray style */}
        <TileLayer
          attribution=''  
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          key="carto-gray"
        />
        
        {/* Alternative clean map styles - uncomment to use:
        
        // Minimal without labels (ultra clean)
        <TileLayer
          attribution='© CartoDB'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        
        // Voyager style (clean and modern)
        <TileLayer
          attribution='© CartoDB'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        // Dark clean theme
        <TileLayer
          attribution='© CartoDB'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        */}
        <MapUpdater location={userLocation} />
        
        {/* User location marker */}
        <Marker 
          position={[userLocation.lat, userLocation.lng]}
          icon={createLocationIcon()}
        >
          <Popup>
            <div className="text-center">
              <strong>Ihr Standort</strong>
              <br />
              <small>{userLocation.address}</small>
            </div>
          </Popup>
        </Marker>
        
        {/* Project sites with radius circles */}
        {constructionSites.map(project => {
          const distance = calculateDistance(userLocation.lat, userLocation.lng, project.lat, project.lng);
          const isInRadius = distance <= 35;
          
          return (
            <React.Fragment key={project.id}>
              {/* 35m radius circle */}
              <Circle
                center={[project.lat, project.lng]}
                radius={35}
                pathOptions={{
                  color: isInRadius ? '#10b981' : '#f97316',
                  fillColor: isInRadius ? '#10b981' : '#f97316',
                  fillOpacity: isInRadius ? 0.15 : 0.1,
                  weight: 2,
                }}
              />
              
              {/* Project site marker */}
              <Marker 
                position={[project.lat, project.lng]}
                icon={createConstructionSiteIcon()}
              >
                <Popup>
                  <div className="text-center">
                    <strong>{project.name}</strong>
                    <br />
                    <small>{project.address}</small>
                    <br />
                    <span className={`text-sm font-medium ${isInRadius ? 'text-green-600' : 'text-orange-600'}`}>
                      {isInRadius ? '✅ Einstempeln möglich' : `${Math.round(distance)}m entfernt`}
                    </span>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;