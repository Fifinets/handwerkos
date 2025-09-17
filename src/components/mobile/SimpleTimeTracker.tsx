import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Square,
  Coffee,
  MapPin,
  Clock
} from "lucide-react"
import { useTimeTracking } from "@/hooks/useTimeTracking"
import { toast } from "sonner"
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Project {
  id: string
  name: string
  customer?: {
    name: string
  }
  location?: string
}

const SimpleTimeTracker: React.FC = () => {
  const { activeTime, isLoading, startTracking, stopTracking, startBreak, endBreak } = useTimeTracking()

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isInRange, setIsInRange] = useState(false)
  const [projectLocation, setProjectLocation] = useState<{ lat: number; lng: number } | null>(null)

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const currentLocationMarker = useRef<mapboxgl.Marker | null>(null)
  const projectLocationMarker = useRef<mapboxgl.Marker | null>(null)

  const RADIUS_METERS = 100

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3
    const φ1 = lat1 * Math.PI/180
    const φ2 = lat2 * Math.PI/180
    const Δφ = (lat2-lat1) * Math.PI/180
    const Δλ = (lon2-lon1) * Math.PI/180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  // Parse location string to coordinates
  const parseLocationString = (location: string) => {
    const matches = location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/)
    if (matches) {
      return {
        lat: parseFloat(matches[1]),
        lng: parseFloat(matches[2])
      }
    }

    return {
      lat: 52.5200, // Berlin fallback
      lng: 13.4050
    }
  }

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const newLocation = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      }

      setCurrentLocation(newLocation)

      // Check if in range
      if (projectLocation) {
        const distance = calculateDistance(
          newLocation.lat,
          newLocation.lng,
          projectLocation.lat,
          projectLocation.lng
        )
        setIsInRange(distance <= RADIUS_METERS)
      }

      // Update marker
      if (currentLocationMarker.current) {
        currentLocationMarker.current.setLngLat([newLocation.lng, newLocation.lat])
      }

      return coordinates
    } catch (error) {
      console.error('Location error:', error)
      toast.error('Standort konnte nicht ermittelt werden')
      return null
    }
  }, [projectLocation])

  // Initialize map
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      mapboxgl.accessToken = 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGFzc2lmaWVkIn0.token'

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.4050, 52.5200],
        zoom: 15
      })

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map markers
  useEffect(() => {
    if (map.current && currentLocation) {
      if (currentLocationMarker.current) {
        currentLocationMarker.current.setLngLat([currentLocation.lng, currentLocation.lat])
      } else {
        currentLocationMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .setPopup(new mapboxgl.Popup().setText('Dein Standort'))
          .addTo(map.current)
      }

      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 16
      })
    }
  }, [currentLocation])

  // Mock project for demo
  useEffect(() => {
    const mockProject = {
      id: '1',
      name: 'Baustelle Musterstraße',
      customer: { name: 'Mustermann GmbH' },
      location: '52.5170,13.3888' // Mock coordinates
    }

    setSelectedProject(mockProject)

    const coords = parseLocationString(mockProject.location!)
    setProjectLocation(coords)

    if (map.current) {
      if (projectLocationMarker.current) {
        projectLocationMarker.current.remove()
      }

      projectLocationMarker.current = new mapboxgl.Marker({ color: '#EF4444' })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(new mapboxgl.Popup().setText(mockProject.name))
        .addTo(map.current)

      // Add radius circle
      const sourceId = 'project-radius'
      const layerId = 'project-radius-layer'

      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId)
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [coords.lng, coords.lat]
          }
        }
      })

      map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': {
            stops: [
              [0, 0],
              [20, RADIUS_METERS / 0.075 / Math.cos(coords.lat * Math.PI / 180)]
            ],
            base: 2
          },
          'circle-color': isInRange ? '#10B981' : '#EF4444',
          'circle-opacity': 0.2,
          'circle-stroke-color': isInRange ? '#10B981' : '#EF4444',
          'circle-stroke-width': 2
        }
      })
    }
  }, [isInRange])

  // Start location tracking
  useEffect(() => {
    getCurrentLocation()
    const interval = setInterval(getCurrentLocation, 10000)
    return () => clearInterval(interval)
  }, [getCurrentLocation])

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  // Get live duration
  const getLiveDuration = () => {
    if (!activeTime.active || !activeTime.segment?.started_at) return 0
    return activeTime.segment.current_duration_minutes || 0
  }

  // Handle start
  const handleStart = async () => {
    if (!selectedProject) {
      toast.error('Kein Projekt ausgewählt')
      return
    }

    try {
      Haptics.impact({ style: ImpactStyle.Light })
    } catch (e) {
      // Haptics not available
    }

    await startTracking(selectedProject.id, 'work', undefined)
  }

  // Handle stop
  const handleStop = async () => {
    try {
      Haptics.impact({ style: ImpactStyle.Heavy })
    } catch (e) {
      // Haptics not available
    }

    await stopTracking()
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header with current time */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-b-3xl shadow-lg">
        <div className="text-center">
          <h1 className="text-xl font-bold">Zeiterfassung</h1>
          <p className="text-blue-100 text-sm">
            {new Date().toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </p>
        </div>
      </div>

      {/* Map Background */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Overlay Content */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Location Status */}
          {selectedProject && (
            <div className="p-4">
              <div className={`bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border-2 ${
                isInRange ? 'border-green-500' : 'border-red-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className={`h-5 w-5 ${isInRange ? 'text-green-600' : 'text-red-600'}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {isInRange ? '✅ Im Arbeitsbereich' : '⚠️ Außerhalb des Arbeitsbereichs'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedProject.name}
                      </p>
                    </div>
                  </div>
                  {currentLocation && projectLocation && (
                    <div className="text-right">
                      <Badge variant={isInRange ? "default" : "destructive"}>
                        {Math.round(calculateDistance(
                          currentLocation.lat,
                          currentLocation.lng,
                          projectLocation.lat,
                          projectLocation.lng
                        ))}m
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{RADIUS_METERS}m Radius</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Timer Card */}
          <div className="p-4">
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md">
              <CardContent className="p-6">
                {/* Timer Display */}
                <div className="text-center mb-6">
                  <div className="text-5xl font-mono font-bold mb-2">
                    {activeTime.active ? formatDuration(getLiveDuration()) : '0:00'}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {activeTime.active ? (
                      activeTime.onBreak ? (
                        <>
                          <div className="h-3 w-3 bg-orange-400 rounded-full animate-pulse" />
                          <span className="text-orange-600 font-medium">⏸️ Pause</span>
                        </>
                      ) : (
                        <>
                          <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse" />
                          <span className="text-green-600 font-medium">▶️ Läuft</span>
                        </>
                      )
                    ) : (
                      <>
                        <div className="h-3 w-3 bg-gray-400 rounded-full" />
                        <span className="text-gray-500 font-medium">⏹️ Zeiterfassung</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Project Info */}
                {selectedProject && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium">Aktuelles Projekt</span>
                    </div>
                    <div className="text-lg font-bold">{selectedProject.name}</div>
                    {selectedProject.customer && (
                      <div className="text-sm text-gray-600">{selectedProject.customer.name}</div>
                    )}
                  </div>
                )}

                {/* Control Buttons */}
                <div className="space-y-3">
                  {!activeTime.active ? (
                    <Button
                      onClick={handleStart}
                      disabled={!selectedProject || isLoading}
                      size="lg"
                      className="w-full h-16 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      <Play className="h-6 w-6 mr-2" />
                      Zeiterfassung starten
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Break/Continue Button */}
                      {!activeTime.onBreak ? (
                        <Button
                          onClick={startBreak}
                          disabled={isLoading}
                          size="lg"
                          variant="outline"
                          className="h-14 border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          <Coffee className="h-5 w-5 mr-2" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          onClick={endBreak}
                          disabled={isLoading}
                          size="lg"
                          className="h-14 bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          <Play className="h-5 w-5 mr-2" />
                          Weiter
                        </Button>
                      )}

                      {/* Stop Button */}
                      <Button
                        onClick={handleStop}
                        disabled={isLoading}
                        size="lg"
                        variant="destructive"
                        className="h-14"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Stopp
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleTimeTracker