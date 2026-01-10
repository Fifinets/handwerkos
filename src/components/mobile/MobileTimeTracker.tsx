import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
// Native select is used instead of shadcn Select for better mobile compatibility
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
  Play,
  Square,
  RotateCcw,
  Clock,
  MapPin,
  Smartphone,
  Wifi,
  WifiOff,
  Battery,
  Calendar,
  User,
  Building,
  Coffee,
  Car,
  AlertTriangle,
  CheckCircle2,
  Navigation
} from "lucide-react"
import { useTimeTracking } from "@/hooks/useTimeTracking"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { Geolocation } from '@capacitor/geolocation'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { KeepAwake } from '@capacitor-community/keep-awake'
import { Network } from '@capacitor/network'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import MobileMaterialRecorder from './MobileMaterialRecorder'
import { differenceInMinutes } from 'date-fns'

interface Project {
  id: string
  name: string
  customer?: {
    name: string
  }
  location?: string
  team?: string[]
  isAssigned?: boolean
  isRecent?: boolean
  lastUsed?: string
  assignedUntil?: string
  assignmentPriority?: number
  assignmentNotes?: string
  locationCoords?: { lat: number; lng: number }
}

const MobileTimeTracker: React.FC = () => {
  const {
    activeTime,
    isLoading,
    startTracking,
    stopTracking,
    switchProject,
    startBreak,
    endBreak
  } = useTimeTracking()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(null)
  const [userHasSelectedProject, setUserHasSelectedProject] = useState<boolean>(false)
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([])
  const [lastUsedProject, setLastUsedProject] = useState<Project | null>(null)
  const [, forceUpdate] = useState({})
  const [workDescription, setWorkDescription] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showProjectSheet, setShowProjectSheet] = useState(false)
  const [isInRange, setIsInRange] = useState(false)
  const [projectLocation, setProjectLocation] = useState<{ lat: number; lng: number } | null>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const currentLocationMarker = useRef<mapboxgl.Marker | null>(null)
  const projectLocationMarker = useRef<mapboxgl.Marker | null>(null)

  const RADIUS_METERS = 100 // 100 Meter Radius

  // Force reset selection on component mount
  useEffect(() => {
    console.log('MobileTimeTracker mounted - resetting selection')
    // Clear ALL project-related localStorage completely
    localStorage.removeItem('selectedProjectDetails')
    localStorage.removeItem('selectedProject') // Remove TodayScreen's saved project
    localStorage.removeItem('activeTimeEntry')
    localStorage.removeItem('activeBreak')
    // Force clear state to empty values
    setSelectedProject('')
    setSelectedProjectDetails(null)
    setUserHasSelectedProject(false)
    // Additional safety: Force update after a small delay
    setTimeout(() => {
      setSelectedProject('')
      setSelectedProjectDetails(null)
      setUserHasSelectedProject(false)
    }, 100)
  }, [])

  // Live timer
  const [currentTime, setCurrentTime] = useState(new Date())
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)

  // Calculate total work time today (excluding breaks)
  const getTotalWorkTimeToday = () => {
    if (!activeTime.segment) return 0
    const startTime = new Date(activeTime.segment.start_time)
    const now = new Date()
    const totalMinutes = differenceInMinutes(now, startTime)
    const breakMinutes = activeTime.segment.break_duration_minutes || 0
    return Math.max(0, totalMinutes - breakMinutes)
  }
  
  // Offline queue for when network is unavailable
  const [offlineQueue, setOfflineQueue] = useState<any[]>([])
  const [showMaterialDialog, setShowMaterialDialog] = useState(false)
  const [materialCount, setMaterialCount] = useState(0)

  // 10h protection
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false)
  const [hasShownOvertimeWarning, setHasShownOvertimeWarning] = useState(false)
  
  // Mobile-specific configuration
  useEffect(() => {
    const setupMobile = async () => {
      try {
        // Set status bar style for mobile
        await StatusBar.setStyle({ style: StatusBarStyle.Light })
        await StatusBar.setBackgroundColor({ color: '#1f2937' })
        
        // Keep screen awake during active tracking
        if (activeTime.active) {
          await KeepAwake.keepAwake()
        } else {
          await KeepAwake.allowSleep()
        }
        
        // Monitor network status
        const networkStatus = await Network.getStatus()
        setIsOnline(networkStatus.connected)
        
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected)
          if (status.connected && offlineQueue.length > 0) {
            processOfflineQueue()
          }
        })
        
      } catch (error) {
        console.error('Mobile setup error:', error)
      }
    }
    
    setupMobile()
  }, [activeTime.active, offlineQueue.length])

  // 10h protection check
  useEffect(() => {
    if (!activeTime.active || !activeTime.segment) return

    const totalWorkMinutes = getTotalWorkTimeToday()
    const totalWorkHours = totalWorkMinutes / 60

    // Show warning at 9.5h (570 minutes)
    if (totalWorkHours >= 9.5 && !hasShownOvertimeWarning) {
      setHasShownOvertimeWarning(true)
      setShowOvertimeWarning(true)

      // Haptic feedback
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})

      toast.warning(`⚠️ Achtung: Sie arbeiten bereits ${totalWorkHours.toFixed(1)}h. Bitte beenden Sie Ihre Arbeit bald.`, {
        duration: 8000,
        action: {
          label: 'Jetzt beenden',
          onClick: () => {
            handleStop()
          }
        }
      })
    }

    // Auto-stop at exactly 10h (600 minutes)
    if (totalWorkHours >= 10) {
      toast.error('🚫 Automatischer Stopp: 10 Stunden Arbeitszeit erreicht!', {
        duration: 5000
      })

      // Force stop
      handleStop()

      // Strong haptic feedback
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
    }
  }, [activeTime, hasShownOvertimeWarning])

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Parse location string to coordinates
  const parseLocationString = (location: string) => {
    // Try to extract coordinates from string
    const matches = location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (matches) {
      return {
        lat: parseFloat(matches[1]),
        lng: parseFloat(matches[2])
      };
    }

    // Fallback coordinates (Berlin)
    return {
      lat: 52.5200,
      lng: 13.4050
    };
  };

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

      // Check if in range of project location
      if (projectLocation) {
        const distance = calculateDistance(
          newLocation.lat,
          newLocation.lng,
          projectLocation.lat,
          projectLocation.lng
        )
        setIsInRange(distance <= RADIUS_METERS)
      }

      // Update marker on map
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
  
  // Process offline queue when connection is restored
  const processOfflineQueue = async () => {
    for (const action of offlineQueue) {
      try {
        switch (action.type) {
          case 'start':
            await startTracking(action.projectId, action.segmentType, action.description)
            break
          case 'stop':
            await stopTracking(action.notes)
            break
          case 'switch':
            await switchProject(action.projectId, action.segmentType, action.description, action.notes)
            break
        }
      } catch (error) {
        console.error('Error processing offline action:', error)
      }
    }
    setOfflineQueue([])
    toast.success('Offline-Aktionen verarbeitet')
  }
  
  // Add action to offline queue
  const addToOfflineQueue = (action: any) => {
    setOfflineQueue(prev => [...prev, { ...action, timestamp: Date.now() }])
    toast.info('Aktion für Offline-Verarbeitung gespeichert')
  }
  
  // Debug: Log active time changes
  useEffect(() => {
    console.log('Active time status changed:', activeTime)
  }, [activeTime])
  
  // Debug: Monitor selectedProject state
  useEffect(() => {
    console.log('=== STATE UPDATE ===');
    console.log('selectedProject state:', selectedProject);
    console.log('selectedProjectDetails state:', selectedProjectDetails);
    console.log('==================');
  }, [selectedProject, selectedProjectDetails])

  // Initialize map when container is ready
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      // Temporary Mapbox token - User needs to provide their own
      mapboxgl.accessToken = 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGFzc2lmaWVkIn0.token' // TODO: Add real token

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [13.4050, 52.5200],
        zoom: 15
      })

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map when location changes
  useEffect(() => {
    if (map.current && currentLocation) {
      // Update or create current location marker
      if (currentLocationMarker.current) {
        currentLocationMarker.current.setLngLat([currentLocation.lng, currentLocation.lat])
      } else {
        currentLocationMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .setPopup(new mapboxgl.Popup().setText('Ihr Standort'))
          .addTo(map.current)
      }

      // Center map on current location
      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 16
      })
    }
  }, [currentLocation])

  // Update project location on map
  useEffect(() => {
    if (selectedProjectDetails?.location) {
      const coords = parseLocationString(selectedProjectDetails.location)
      setProjectLocation(coords)

      if (map.current) {
        // Remove old project marker
        if (projectLocationMarker.current) {
          projectLocationMarker.current.remove()
        }

        // Add new project marker
        projectLocationMarker.current = new mapboxgl.Marker({ color: '#EF4444' })
          .setLngLat([coords.lng, coords.lat])
          .setPopup(new mapboxgl.Popup().setText(selectedProjectDetails.name))
          .addTo(map.current)

        // Add radius circle
        const sourceId = 'project-radius'
        const layerId = 'project-radius-layer'

        // Remove existing source and layer if they exist
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId)
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId)
        }

        // Add new source and layer for radius
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

        // Fit map to show both markers
        if (currentLocation) {
          const bounds = new mapboxgl.LngLatBounds()
          bounds.extend([currentLocation.lng, currentLocation.lat])
          bounds.extend([coords.lng, coords.lat])
          map.current.fitBounds(bounds, { padding: 50 })
        }
      }

      // Check if current location is in range
      if (currentLocation) {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          coords.lat,
          coords.lng
        )
        setIsInRange(distance <= RADIUS_METERS)
      }
    }
  }, [selectedProjectDetails, currentLocation, isInRange])

  // Start location tracking
  useEffect(() => {
    getCurrentLocation()

    // Update location every 10 seconds
    const interval = setInterval(() => {
      getCurrentLocation()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Update project details only when selectedProject changes (not when projects load)
  useEffect(() => {
    console.log('Selected project changed to:', selectedProject)
    // Only update details if a project is actually selected
    if (selectedProject && selectedProject !== '') {
      console.log('MobileTimeTracker: Finding project details for:', selectedProject)
      let projectDetails = null
      try {
        if (projects && Array.isArray(projects) && projects.length > 0) {
          projectDetails = projects.find(p => p && p.id === selectedProject)
        }
      } catch (error) {
        console.error('MobileTimeTracker: Error finding project:', error)
      }
      if (projectDetails) {
        setSelectedProjectDetails(projectDetails)
        console.log('Project details updated:', projectDetails)
      } else {
        console.log('Project not found in list, clearing details')
        setSelectedProjectDetails(null)
      }
    } else {
      console.log('No project selected - clearing details')
      setSelectedProjectDetails(null)
    }
  }, [selectedProject])

  // Load projects with assignment status
  useEffect(() => {
    const loadProjectsWithAssignments = async () => {
      try {
        console.log('🚀 STARTING TO LOAD PROJECTS...')

        // Reset selection state at start
        setSelectedProject('')
        setSelectedProjectDetails(null)

        // Load projects and check for assignments
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            status,
            location,
            customer_id,
            customers(id, name, company_name)
          `)
          .order('name')

        if (projectsError) {
          console.error('💥 DATABASE ERROR loading projects:', projectsError)
          toast.error('Fehler beim Laden der Projekte')
          return
        }

        console.log('✅ PROJECTS FROM DATABASE:', projectsData)

        if (!projectsData || projectsData.length === 0) {
          console.log('No projects found in database')
          setProjects([])
          toast.error('Keine Projekte in der Datenbank gefunden')
          return
        }

        // Get current user's employee ID
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setProjects(projectsData)
          return
        }

        // Get current user's employee info
        const { data: employee } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('user_id', user.id)
          .single()

        if (!employee) {
          console.log('No employee record found for user')
          setProjects(projectsData)
          return
        }

        console.log('Current employee ID for assignment check:', employee.id)

        // Get project assignments for this employee
        const { data: assignmentsData } = await supabase
          .from('project_assignments')
          .select('project_id, role, start_date, end_date, notes')
          .eq('employee_id', employee.id)

        const assignedProjectIds = new Set(
          assignmentsData?.map(assignment => assignment.project_id) || []
        )

        console.log('Employee assigned to project IDs:', Array.from(assignedProjectIds))

        // Smart sorting: assigned > recent > alphabetical
        const assignedProjectsList = []
        const recentProjectsList = []
        const regularProjectsList = []

        for (const project of projectsData) {
          // Format customer data properly
          const formattedProject = {
            ...project,
            customer: project.customers ? {
              id: project.customers.id,
              name: project.customers.company_name || project.customers.name
            } : null
          }
          delete formattedProject.customers // Remove the nested customers field

          // Check if user is assigned to this project via project_assignments table
          const isAssigned = assignedProjectIds.has(project.id)
          const assignmentInfo = assignmentsData?.find(a => a.project_id === project.id)

          console.log(`Project ${formattedProject.name}: isAssigned=${isAssigned}, customer=${formattedProject.customer?.name}`)

          if (isAssigned) {
            assignedProjectsList.push({
              ...formattedProject,
              isAssigned: true,
              assignmentPriority: 1,
              assignmentNotes: assignmentInfo?.notes || 'Vom Manager zugewiesen',
              assignmentRole: assignmentInfo?.role || 'mitarbeiter'
            })
          } else {
            regularProjectsList.push({
              ...formattedProject,
              isAssigned: false
            })
          }
        }

        // Get recent projects (last 7 days) for smart sorting
        try {
          const { data: recentTimesheets } = await supabase
            .from('timesheets')
            .select(`
              project_id,
              date,
              projects(id, name, customers(name))
            `)
            .eq('employee_id', employee?.id || user.id)
            .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: false })
            .order('start_time', { ascending: false })

          if (recentTimesheets && recentTimesheets.length > 0) {
            // Get unique recent project IDs
            const recentProjectIds = [...new Set(recentTimesheets.map(ts => ts.project_id))]

            // Set last used project (most recent)
            const lastProject = recentTimesheets[0]?.projects
            if (lastProject) {
              setLastUsedProject({
                id: lastProject.id,
                name: lastProject.name,
                customer: lastProject.customers
              })
            }

            // Move recent projects to separate list (but not assigned ones)
            for (let i = regularProjectsList.length - 1; i >= 0; i--) {
              const project = regularProjectsList[i]
              if (recentProjectIds.includes(project.id)) {
                // Remove from regular list and add to recent list
                regularProjectsList.splice(i, 1)
                recentProjectsList.push({
                  ...project,
                  isRecent: true,
                  lastUsed: recentTimesheets.find(ts => ts.project_id === project.id)?.date
                })
              }
            }

            // Sort recent projects by last usage
            recentProjectsList.sort((a, b) => {
              const dateA = new Date(a.lastUsed || 0)
              const dateB = new Date(b.lastUsed || 0)
              return dateB.getTime() - dateA.getTime()
            })
          }
        } catch (error) {
          console.log('No recent timesheets found:', error)
        }

        // Combine: assigned > recent > alphabetical
        const allProjects = [
          ...assignedProjectsList,
          ...recentProjectsList,
          ...regularProjectsList.sort((a, b) => a.name.localeCompare(b.name))
        ]

        setProjects(allProjects)
        setAssignedProjects(assignedProjectsList)

        console.log(`Smart sorted projects: ${assignedProjectsList.length} assigned, ${recentProjectsList.length} recent, ${regularProjectsList.length} other`)
        console.log('Assigned projects:', assignedProjectsList.map(p => p.name))
        console.log('Recent projects:', recentProjectsList.map(p => p.name))

        // No auto-selection - user must choose manually
        console.log('Projects loaded - user must choose manually')
        // Ensure clean state
        if (!selectedProject) {
          setSelectedProject('')
          setSelectedProjectDetails(null)
        }

        console.log(`Loaded ${allProjects.length} projects: ${assignedProjectsList.length} assigned, ${recentProjectsList.length} recent, ${regularProjectsList.length} other`)
        console.log('🔍 ALL PROJECTS FROM DATABASE:', allProjects.map(p => ({ id: p.id, name: p.name, customer: p.customer?.name })))

      } catch (error) {
        console.error('Error loading projects with assignments:', error)
        toast.error('Fehler beim Laden der Projekte')
      }
    }

    loadProjectsWithAssignments()
  }, [])
  
  // Live timer updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Get live duration (excluding break time)
  const getLiveDuration = () => {
    if (!activeTime.active || !activeTime.segment?.started_at) return 0

    // Use the duration from the hook which already accounts for breaks
    return activeTime.segment.current_duration_minutes || 0
  }
  
  // Format duration for display
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }
  
  // Haptic feedback helper
  const triggerHaptic = (style: ImpactStyle = ImpactStyle.Medium) => {
    try {
      Haptics.impact({ style })
    } catch (error) {
      // Haptics not available on this device
    }
  }
  
  // Handle start with location and offline support
  const handleStart = async () => {
    
    if (!selectedProject) {
      toast.error('Bitte wählen Sie ein Projekt aus')
      return
    }
    
    triggerHaptic(ImpactStyle.Light)
    
    if (!isOnline) {
      addToOfflineQueue({
        type: 'start',
        projectId: selectedProject,
        segmentType: 'work',
        description
      })
      return
    }
    
    // Get location if available
    await getCurrentLocation()
    
    await startTracking(selectedProject, 'work', undefined)
  }
  
  // Handle stop with offline support
  const handleStop = async () => {
    triggerHaptic(ImpactStyle.Heavy)

    if (!isOnline) {
      addToOfflineQueue({
        type: 'stop',
        notes: `${workDescription}${notes ? `\n\nNotizen: ${notes}` : ''}`
      })
      return
    }

    // Combine work description and notes
    const finalNotes = workDescription
      ? `${workDescription}${notes ? `\n\nNotizen: ${notes}` : ''}`
      : notes || undefined

    await stopTracking(finalNotes)
    setWorkDescription('')
    setNotes('')
  }
  
  // Handle switch with offline support
  const handleSwitch = async () => {
    if (!selectedProject) {
      toast.error('Bitte wählen Sie ein Projekt aus')
      return
    }
    
    triggerHaptic(ImpactStyle.Light)
    
    if (!isOnline) {
      addToOfflineQueue({
        type: 'switch',
        projectId: selectedProject,
        segmentType: 'work',
        description,
        notes
      })
      return
    }
    
    await switchProject(selectedProject, 'work', description || undefined, notes || undefined)
    setDescription('')
    setNotes('')
    setShowProjectSheet(false)
  }
  
  // Get segment type icon
  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'work': return <Clock className="h-4 w-4" />
      case 'break': return <Coffee className="h-4 w-4" />
      case 'drive': return <Car className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 pt-12 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Zeiterfassung</h1>
            <p className="text-blue-100 text-sm">
              {currentTime.toLocaleDateString('de-DE', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Network Status */}
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-300" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-300" />
            )}
            
            {/* Offline Queue Indicator */}
            {offlineQueue.length > 0 && (
              <Badge variant="secondary" className="bg-yellow-500 text-white">
                {offlineQueue.length}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Current Status */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          {activeTime.active ? (
            <div className="text-center">
              <div className="text-3xl font-mono font-bold mb-2">
                {formatDuration(getLiveDuration())}
              </div>
              <div className="flex items-center justify-center gap-2 text-blue-100 mb-2">
                {!activeTime.onBreak ? (
                  <>
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm">Aktiv seit {new Date(activeTime.segment!.started_at).toLocaleTimeString('de-DE')}</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 bg-orange-400 rounded-full animate-pulse" />
                    <span className="text-sm">⏸️ Pause ({formatDuration(activeTime.segment?.break_duration_minutes || 0)})</span>
                  </>
                )}
              </div>
              <div className="text-lg font-medium text-white">
                {activeTime.segment?.project_name || 'Allgemein'}
              </div>
              {activeTime.segment?.customer_name && (
                <div className="text-sm text-blue-100 mt-1">
                  {activeTime.segment.customer_name}
                </div>
              )}
              {activeTime.onBreak && (
                <div className="text-xs text-orange-200 mt-2">
                  ☕ Pausenzeit wird von Arbeitszeit abgezogen
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">Keine aktive Zeiterfassung</div>
              <div className="text-blue-100 text-sm">Bitte wählen Sie ein Projekt aus</div>
            </div>
          )}
        </div>
      </div>
      

      {/* Main Content with Map Background */}
      <div className="relative min-h-[calc(100vh-200px)]">
        {/* Map Container */}
        <div ref={mapContainer} className="absolute inset-0 z-0" />

        {/* Overtime warning overlay */}
        {activeTime.active && (() => {
          const totalWorkMinutes = getTotalWorkTimeToday()
          const totalWorkHours = totalWorkMinutes / 60

          if (totalWorkHours >= 9.5) {
            return (
              <div className="absolute top-4 left-4 right-4 z-20">
                <div className="bg-orange-500/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border-2 border-orange-400">
                  <div className="flex items-center gap-2 text-white">
                    <AlertTriangle className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-bold">
                        ⚠️ Überstunden: {totalWorkHours.toFixed(1)}h gearbeitet
                      </p>
                      <p className="text-xs opacity-90">
                        {totalWorkHours >= 10 ? 'Automatischer Stopp erfolgt!' : 'Bitte beenden Sie bald Ihre Arbeit'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}

        {/* Overlay for location status */}
        {selectedProjectDetails?.location && (
          <div className="absolute top-4 left-4 right-4 z-10" style={{
            marginTop: activeTime.active && getTotalWorkTimeToday() / 60 >= 9.5 ? '80px' : '0'
          }}>
            <div className={`bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border-2 ${
              isInRange ? 'border-green-500' : 'border-red-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className={`h-5 w-5 ${isInRange ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {isInRange ? '✅ Im Arbeitsbereich' : '❌ Außerhalb des Arbeitsbereichs'
                    </p>
                    <p className="text-xs text-gray-600">
                      {selectedProjectDetails.name} ({RADIUS_METERS}m Radius)
                    </p>
                  </div>
                </div>
                {currentLocation && projectLocation && (
                  <Badge variant={isInRange ? "default" : "destructive"}>
                    {Math.round(calculateDistance(
                      currentLocation.lat,
                      currentLocation.lng,
                      projectLocation.lat,
                      projectLocation.lng
                    ))}m
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timer Card at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe">
          <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {activeTime.active ? 'Laufende Erfassung' : 'Zeiterfassung starten'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeTime.active ? (
              <>
                
                {/* Project Selection - Button Based */}
                <div className="space-y-2">
                  <Label>
                    {selectedProject ? '✅ Ausgewähltes Projekt' : '⚠️ Projekt auswählen'}
                  </Label>
                  
                  {/* Show selected project or selection prompt */}
                  {selectedProject && selectedProjectDetails ? (
                    /* Diese Box zeigt das ausgewählte Projekt an, nachdem es aus der Liste gewählt wurde */
                    <div
                      className="w-full p-4 text-left rounded-lg border-2 border-green-500 bg-green-50"
                      onClick={() => {
                        console.log('Clearing selection');
                        setSelectedProject('');
                        setSelectedProjectDetails(null);
                        setUserHasSelectedProject(false);
                      }}
                    >
                      <div className="font-medium text-green-900">{selectedProjectDetails.name}</div>
                      {selectedProjectDetails.customer && (
                        <>
                          <div className="text-sm text-green-700 font-medium mt-2">
                            {selectedProjectDetails.customer.name}
                          </div>
                          {selectedProjectDetails.customer.phone && (
                            <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
                              📞 {selectedProjectDetails.customer.phone}
                            </div>
                          )}
                        </>
                      )}
                      {selectedProjectDetails.location && (
                        <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
                          📍 {selectedProjectDetails.location}
                        </div>
                      )}
                      {(selectedProjectDetails.start_date || selectedProjectDetails.planned_end_date) && (
                        <div className="text-sm text-green-600 flex items-center gap-1 mt-1">
                          📅 {selectedProjectDetails.start_date ? new Date(selectedProjectDetails.start_date).toLocaleDateString('de-DE') : ''}
                          {selectedProjectDetails.start_date && selectedProjectDetails.planned_end_date && ' - '}
                          {selectedProjectDetails.planned_end_date ? new Date(selectedProjectDetails.planned_end_date).toLocaleDateString('de-DE') : ''}
                        </div>
                      )}
                      <div className="text-xs text-green-600 mt-2">Tippen zum Ändern</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projects.length === 0 ? (
                        <div className="text-center text-gray-500 p-4">
                          Keine Projekte verfügbar
                        </div>
                      ) : (
                        projects.map((project) => (
                          <div
                            key={project.id}
                            onClick={() => {
                              console.log('🎯 PROJEKT AUSWAHL:', project);
                              setSelectedProject(project.id);
                              setSelectedProjectDetails(project);
                              setUserHasSelectedProject(true);

                              const toastMessage = project.isAssigned
                                ? `Zugewiesenes Projekt "${project.name}" ausgewählt`
                                : `Projekt "${project.name}" ausgewählt`;

                              toast.success(toastMessage, {
                                style: project.isAssigned
                                  ? { backgroundColor: '#e0f2fe', borderColor: '#0284c7' }
                                  : {}
                              });

                              try {
                                Haptics.impact({ style: ImpactStyle.Light });
                              } catch (e) {
                                // Haptics not available
                              }
                            }}
                            className={`w-full p-3 text-left rounded-lg border-2 transition-colors cursor-pointer ${
                              /* BLAUE CARD: Für zugewiesene Projekte in der Auswahlliste */
                              /* ORANGE CARD: Für kürzlich verwendete Projekte */
                              /* GRAUE CARD: Für normale Projekte */
                              project.isAssigned
                                ? 'border-blue-400 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 active:bg-blue-150'
                                : project.isRecent
                                ? 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 active:bg-orange-150'
                                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium flex items-center gap-2">
                                  {project.name}
                                  {project.isAssigned && (
                                    <span className="text-xs px-2 py-1 bg-blue-200 text-blue-800 rounded-full font-medium">
                                      Zugewiesen
                                    </span>
                                  )}
                                  {project.isRecent && !project.isAssigned && (
                                    <span className="text-xs px-2 py-1 bg-orange-200 text-orange-800 rounded-full font-medium">
                                      Kürzlich
                                    </span>
                                  )}
                                </div>
                                {project.customer && (
                                  <>
                                    <div className="text-sm text-gray-600 font-medium">{project.customer.name}</div>
                                    {project.customer.phone && (
                                      <div className="text-xs text-gray-500 mt-1">📞 {project.customer.phone}</div>
                                    )}
                                  </>
                                )}
                                {project.location && (
                                  <div className="text-xs text-gray-500 mt-1">📍 {project.location}</div>
                                )}
                                {(project.start_date || project.planned_end_date) && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    📅 {project.start_date ? new Date(project.start_date).toLocaleDateString('de-DE') : ''}
                                    {project.start_date && project.planned_end_date && ' - '}
                                    {project.planned_end_date ? new Date(project.planned_end_date).toLocaleDateString('de-DE') : ''}
                                  </div>
                                )}
                                {project.isAssigned && project.assignmentNotes && (
                                  <div className="text-xs text-blue-600 mt-1">{project.assignmentNotes}</div>
                                )}
                                {project.isRecent && !project.isAssigned && (
                                  <div className="text-xs text-orange-600 mt-1">
                                    ⏱️ Zuletzt verwendet: {new Date(project.lastUsed || '').toLocaleDateString('de-DE')}
                                  </div>
                                )}
                              </div>
                              {project.isAssigned && (
                                <div className="text-blue-500">
                                  ⭐
                                </div>
                              )}
                              {project.isRecent && !project.isAssigned && (
                                <div className="text-orange-500">
                                  ⏱️
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                
                {/* Start Button */}
                <Button 
                  onClick={handleStart}
                  disabled={!selectedProject || !selectedProjectDetails || isLoading}
                  size="lg"
                  className={`w-full h-14 text-lg ${
                    selectedProject && selectedProjectDetails && !isLoading
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' 
                      : 'bg-gray-400'
                  }`}
                >
                  <Play className="h-6 w-6 mr-2" />
                  {selectedProject && selectedProjectDetails ? 'Zeiterfassung starten' : 'Bitte Projekt wählen'}
                </Button>
              </>
            ) : (
              <>
                {/* Active Session Controls */}
                <div className="space-y-3">
                  {/* Work Description for current session */}
                  <div className="space-y-2">
                    <Label htmlFor="mobile-work-description">Arbeitsbeschreibung</Label>
                    <Textarea
                      id="mobile-work-description"
                      value={workDescription}
                      onChange={(e) => setWorkDescription(e.target.value)}
                      placeholder="Was arbeiten Sie gerade? (z.B. Elektroinstallation, Malerarbeiten...)"
                      rows={2}
                      className="text-base"
                    />
                  </div>

                  {/* Additional Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="mobile-notes">Zusätzliche Notizen (optional)</Label>
                    <Textarea
                      id="mobile-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Besonderheiten, Material, etc..."
                      rows={2}
                      className="text-base"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {/* Break/Continue Button */}
                    {!activeTime.onBreak ? (
                      <Button
                        onClick={startBreak}
                        disabled={isLoading}
                        size="lg"
                        variant="outline"
                        className="w-full h-12 text-base border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Coffee className="h-5 w-5 mr-2" />
                        Pause starten
                      </Button>
                    ) : (
                      <Button
                        onClick={endBreak}
                        disabled={isLoading}
                        size="lg"
                        className="w-full h-12 text-base bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Pause beenden ({formatDuration(activeTime.segment?.break_duration_minutes || 0)})
                      </Button>
                    )}

                    {/* Stop Button */}
                    <Button
                      onClick={handleStop}
                      disabled={isLoading}
                      size="lg"
                      variant="destructive"
                      className="w-full h-14 text-lg"
                    >
                      <Square className="h-6 w-6 mr-2" />
                      Zeiterfassung beenden
                    </Button>
                    
                    
                    {/* Switch Project Button */}
                    <Sheet open={showProjectSheet} onOpenChange={setShowProjectSheet}>
                      <SheetTrigger asChild>
                        <Button 
                          variant="outline"
                          size="lg"
                          className="h-12 text-base border-2"
                        >
                          <RotateCcw className="h-5 w-5 mr-2" />
                          Projekt wechseln
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="h-[80vh]" onPointerDownOutside={(e) => e.preventDefault()}>
                        <SheetHeader className="text-left pb-4">
                          <SheetTitle>Projekt wechseln</SheetTitle>
                          <SheetDescription>
                            Wählen Sie ein neues Projekt aus. Die aktuelle Erfassung wird automatisch beendet.
                          </SheetDescription>
                        </SheetHeader>
                        
                        <div className="space-y-4">
                          {/* New Project Selection */}
                          <div className="space-y-2">
                            <Label htmlFor="mobile-switch-project">Neues Projekt</Label>
                            <select 
                              id="mobile-switch-project"
                              value={selectedProject} 
                              onChange={(e) => {
                                e.stopPropagation();
                                const value = e.target.value;
                                console.log('Switch project selection changed to:', value);
                                setSelectedProject(value);
                                // Update project details immediately
                                const project = projects && projects.length > 0 ? projects.find(p => p.id === value) : null;
                                if (project) {
                                  console.log('Found project details for switch:', project);
                                  setSelectedProjectDetails(project);
                                } else {
                                  setSelectedProjectDetails(null);
                                }
                                // Haptic feedback on selection
                                if (value) {
                                  Haptics.impact({ style: ImpactStyle.Light });
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-full h-14 px-4 text-lg rounded-lg border-2 appearance-none cursor-pointer ${
                                selectedProject 
                                  ? 'border-green-500 bg-green-50 text-green-900' 
                                  : 'border-orange-400 bg-orange-50 text-gray-900'
                              } focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-blue-500`}
                              style={{
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 1rem center',
                                backgroundSize: '1.5em',
                                paddingRight: '3rem'
                              }}
                            >
                              <option value="">📋 Neues Projekt wählen...</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name} {project.customer ? `- ${project.customer.name}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* New Description */}
                          <div className="space-y-2">
                            <Label>Neue Beschreibung</Label>
                            <Textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Beschreibung für das neue Projekt..."
                              rows={2}
                              className="text-base"
                            />
                          </div>
                          
                          {/* Notes for previous session */}
                          <div className="space-y-2">
                            <Label>Notizen für vorherige Erfassung</Label>
                            <Textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Abschlussnotizen für die aktuelle Erfassung..."
                              rows={2}
                              className="text-base"
                            />
                          </div>
                          
                          {/* Switch Button */}
                          <Button 
                            onClick={handleSwitch}
                            disabled={!selectedProject || isLoading}
                            size="lg"
                            className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-indigo-500"
                          >
                            <RotateCcw className="h-6 w-6 mr-2" />
                            Projekt wechseln
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Additional Status Info */}
      <div className="p-4 space-y-4">
        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Network Status */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className={`inline-flex items-center gap-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                <span className="font-medium">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              {offlineQueue.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {offlineQueue.length} Aktion{offlineQueue.length > 1 ? 'en' : ''} wartend
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Location Status */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className={`inline-flex items-center gap-2 ${currentLocation ? 'text-blue-600' : 'text-gray-400'}`}>
                <MapPin className="h-5 w-5" />
                <span className="font-medium">
                  {currentLocation ? 'Standort' : 'Kein Standort'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentLocation ? 'Verfügbar' : 'Nicht verfügbar'}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Warning if offline */}
        {!isOnline && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-orange-900 dark:text-orange-100">
                    Offline-Modus
                  </div>
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    Ihre Aktionen werden gespeichert und synchronisiert, sobald die Verbindung wiederhergestellt ist.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Success indicator when actions are queued */}
        {isOnline && offlineQueue.length === 0 && activeTime.active && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="font-medium text-green-900 dark:text-green-100">
                  Zeiterfassung läuft und wird synchronisiert
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Material Recorder Dialog */}
      <MobileMaterialRecorder
        projectId={activeTime.segment?.project_id || selectedProject || ''}
        projectName={activeTime.segment?.project_name || selectedProjectDetails?.name}
        isOpen={showMaterialDialog}
        onClose={() => setShowMaterialDialog(false)}
        onMaterialAdded={() => {
          setMaterialCount(prev => prev + 1)
          toast.success('Material wurde verbucht')
        }}
      />
    </div>
  )
}

export default MobileTimeTracker