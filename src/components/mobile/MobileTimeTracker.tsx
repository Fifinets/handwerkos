import React, { useState, useEffect, useCallback } from 'react'
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
  CheckCircle2
} from "lucide-react"
import { useTimeTracking } from "@/hooks/useTimeTracking"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { Geolocation } from '@capacitor/geolocation'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { KeepAwake } from '@capacitor/keep-awake'
import { Network } from '@capacitor/network'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

interface Project {
  id: string
  name: string
  customer?: {
    name: string
  }
  location?: string
}

const MobileTimeTracker: React.FC = () => {
  const { 
    activeTime, 
    isLoading, 
    startTracking, 
    stopTracking, 
    switchProject 
  } = useTimeTracking()
  
  // Initialize with mock projects
  const mockProjectsDefault = [
    {
      id: '6c81e627-8c38-472b-ae6b-5c63af8b9016',
      name: 'Baustelle Musterstraße',
      status: 'active',
      customer: { name: 'Mustermann GmbH' }
    },
    {
      id: 'mock-project-2',
      name: 'Renovierung Bürogebäude',
      status: 'active',
      customer: { name: 'Schmidt & Co' }
    },
    {
      id: 'mock-project-3',
      name: 'Neubau Einfamilienhaus',
      status: 'active',
      customer: { name: 'Bau AG' }
    }
  ]
  
  const [projects, setProjects] = useState<Project[]>(mockProjectsDefault)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(null)
  const [, forceUpdate] = useState({})
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showProjectSheet, setShowProjectSheet] = useState(false)
  
  // Live timer
  const [currentTime, setCurrentTime] = useState(new Date())
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  
  // Offline queue for when network is unavailable
  const [offlineQueue, setOfflineQueue] = useState<any[]>([])
  
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
  
  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })
      
      setCurrentLocation({
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      })
      
      return coordinates
    } catch (error) {
      console.error('Location error:', error)
      toast.error('Standort konnte nicht ermittelt werden')
      return null
    }
  }, [])
  
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

  // Debug: Log project selection changes and update project details
  useEffect(() => {
    console.log('Selected project changed to:', selectedProject)
    console.log('Available projects:', projects.length, projects.map(p => ({ id: p.id, name: p.name })))
    // Update selected project details
    if (selectedProject) {
      const projectDetails = projects.find(p => p.id === selectedProject)
      if (projectDetails) {
        setSelectedProjectDetails(projectDetails)
        console.log('Project details updated:', projectDetails)
      } else {
        console.log('Project not found in list:', selectedProject)
      }
    } else {
      setSelectedProjectDetails(null)
    }
  }, [selectedProject, projects])

  // Load projects from database
  useEffect(() => {
    const loadProjects = async () => {
      try {
        console.log('Loading projects from database...')
        
        // Load all projects from database
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            status,
            customer:customers(name)
          `)
          .order('name')
        
        if (error) {
          console.error('Database error loading projects:', error)
          toast.error('Fehler beim Laden der Projekte')
          return
        }
        
        if (data && data.length > 0) {
          console.log('Loaded projects from database:', data.length, data)
          setProjects(data)
          toast.success(`${data.length} Projekte geladen`)
        } else {
          console.log('No projects found in database, data:', data)
          setProjects([])
          toast.warning('Keine Projekte in der Datenbank gefunden')
        }
      } catch (error) {
        console.error('Error loading projects:', error)
        toast.error('Fehler beim Laden der Projekte')
      }
    }
    
    loadProjects()
  }, [])
  
  // Live timer updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Get live duration
  const getLiveDuration = () => {
    if (!activeTime.active || !activeTime.segment?.started_at) return 0
    
    const start = new Date(activeTime.segment.started_at)
    const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000 / 60)
    return Math.max(0, diff)
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
    console.log('handleStart called with selectedProject:', selectedProject);
    console.log('selectedProjectDetails:', selectedProjectDetails);
    
    if (!selectedProject) {
      console.log('No project selected, showing error');
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
    
    await startTracking(selectedProject, 'work', description || undefined)
    setDescription('')
  }
  
  // Handle stop with offline support
  const handleStop = async () => {
    triggerHaptic(ImpactStyle.Heavy)
    
    if (!isOnline) {
      addToOfflineQueue({
        type: 'stop',
        notes
      })
      return
    }
    
    await stopTracking(notes || undefined)
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
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm">Aktiv seit {new Date(activeTime.segment!.started_at).toLocaleTimeString('de-DE')}</span>
              </div>
              <div className="text-lg font-medium">
                {activeTime.segment?.project_name || 'Allgemein'}
              </div>
              {activeTime.segment?.customer_name && (
                <div className="text-sm text-blue-200 mt-1">
                  {activeTime.segment.customer_name}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              {selectedProjectDetails ? (
                <>
                  <div className="text-lg font-medium mb-1">{selectedProjectDetails.name}</div>
                  {selectedProjectDetails.customer && (
                    <div className="text-sm text-blue-200 mb-2">{selectedProjectDetails.customer.name}</div>
                  )}
                  <div className="text-xs text-blue-100">Bereit zum Start</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold mb-2">Keine aktive Zeiterfassung</div>
                  <div className="text-blue-100 text-sm">Bitte wählen Sie ein Projekt aus</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Debug Info - ALWAYS visible at top */}
      <div className="p-2 bg-yellow-100 rounded text-xs text-gray-800 mx-4 mt-2 space-y-1">
        <div><strong>DEBUG:</strong> activeTime.active = {String(activeTime.active)}</div>
        <div>selectedProject = {selectedProject || 'none'}</div>
        {selectedProjectDetails && (
          <div>selectedProjectDetails = {selectedProjectDetails.name}</div>
        )}
        <div>projects loaded = {projects.length}</div>
        {projects.length > 0 && (
          <div>First project: {projects[0].name} (ID: {projects[0].id})</div>
        )}
        <div>Projects list: {JSON.stringify(projects.map(p => ({ id: p.id, name: p.name })))}</div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 pb-safe">
        {/* Quick Actions */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {activeTime.active ? 'Laufende Erfassung' : 'Zeiterfassung starten'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeTime.active ? (
              <>
                {/* Debug Info - always visible for now */}
                <div className="p-2 bg-gray-100 rounded text-xs text-gray-600 mb-3 space-y-1">
                  <div>Debug: activeTime.active = {String(activeTime.active)}</div>
                  <div>selectedProject = {selectedProject || 'none'}</div>
                  {selectedProjectDetails && (
                    <div>selectedProjectDetails = {selectedProjectDetails.name}</div>
                  )}
                  <div>projects loaded = {projects.length}</div>
                  {projects.length > 0 && (
                    <div>First project: {projects[0].name} (ID: {projects[0].id})</div>
                  )}
                  <div>Projects list: {JSON.stringify(projects.map(p => ({ id: p.id, name: p.name })))}</div>
                  {activeTime.segment && (
                    <>
                      <div>Active segment ID: {activeTime.segment.id}</div>
                      <div>Active project: {activeTime.segment.project_name}</div>
                    </>
                  )}
                </div>
                
                {/* Project Selection - Button Based */}
                <div className="space-y-2">
                  <Label>
                    {selectedProject ? '✅ Ausgewähltes Projekt' : '⚠️ Projekt auswählen'}
                  </Label>
                  
                  {/* Show selected project or selection prompt */}
                  {selectedProject && selectedProjectDetails ? (
                    <div 
                      className="w-full p-4 text-left rounded-lg border-2 border-green-500 bg-green-50"
                      onClick={() => {
                        console.log('Clearing selection');
                        setSelectedProject('');
                        setSelectedProjectDetails(null);
                      }}
                    >
                      <div className="font-medium text-green-900">{selectedProjectDetails.name}</div>
                      {selectedProjectDetails.customer && (
                        <div className="text-sm text-green-700">{selectedProjectDetails.customer.name}</div>
                      )}
                      <div className="text-xs text-green-600 mt-1">Tippen zum Ändern</div>
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
                              console.log('=== PROJECT CLICK ===');
                              console.log('Selecting project:', project.id, project.name);
                              setSelectedProject(project.id);
                              setSelectedProjectDetails(project);
                              // Save to localStorage for mock tracking
                              localStorage.setItem('selectedProjectDetails', JSON.stringify(project));
                              console.log('Project selected and stored');
                              toast.success(`Projekt "${project.name}" ausgewählt`);
                              try {
                                Haptics.impact({ style: ImpactStyle.Light });
                              } catch (e) {
                                console.log('Haptics not available');
                              }
                            }}
                            className="w-full p-3 text-left rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors active:bg-blue-100 cursor-pointer"
                          >
                            <div className="font-medium">{project.name}</div>
                            {project.customer && (
                              <div className="text-sm text-gray-600">{project.customer.name}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="mobile-description">Beschreibung (optional)</Label>
                  <Textarea
                    id="mobile-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Was werden Sie arbeiten?"
                    rows={2}
                    className="text-base"
                  />
                </div>
                
                {/* Visual feedback for selected project */}
                {selectedProject && selectedProjectDetails && (
                  <div className="p-3 bg-green-100 border border-green-500 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="h-5 w-5" />
                      <div>
                        <div className="font-semibold">Projekt ausgewählt:</div>
                        <div className="text-sm">{selectedProjectDetails.name}</div>
                        {selectedProjectDetails.customer && (
                          <div className="text-xs text-green-600">{selectedProjectDetails.customer.name}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
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
                  {/* Notes for current session */}
                  <div className="space-y-2">
                    <Label htmlFor="mobile-notes">Notizen hinzufügen</Label>
                    <Textarea
                      id="mobile-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notizen für diese Arbeitszeit..."
                      rows={2}
                      className="text-base"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Stop Button */}
                    <Button 
                      onClick={handleStop}
                      disabled={isLoading}
                      size="lg"
                      variant="destructive"
                      className="h-14 text-lg"
                    >
                      <Square className="h-6 w-6 mr-2" />
                      Zeiterfassung beenden
                    </Button>
                    
                    {/* Emergency Stop - Only in development */}
                    {process.env.NODE_ENV === 'development' && (
                      <Button 
                        onClick={async () => {
                          try {
                            // Force stop all active sessions
                            const { error } = await supabase
                              .from('time_segments')
                              .update({ 
                                ended_at: new Date().toISOString(),
                                status: 'completed',
                                notes: 'Notfall-Stop'
                              })
                              .is('ended_at', null)
                              .eq('status', 'active')
                            
                            if (!error) {
                              toast.success('Alle aktiven Sessions gestoppt')
                              window.location.reload()
                            }
                          } catch (err) {
                            console.error('Emergency stop error:', err)
                          }
                        }}
                        size="sm"
                        variant="outline"
                        className="h-10 text-xs border-red-300 text-red-600"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Notfall-Stop (Dev)
                      </Button>
                    )}
                    
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
                                const project = projects.find(p => p.id === value);
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