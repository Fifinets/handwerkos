import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
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
  
  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            customer:customers(name)
          `)
          .eq('status', 'active')
          .order('name')
        
        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error('Error loading projects:', error)
        if (isOnline) {
          toast.error('Fehler beim Laden der Projekte')
        }
      }
    }
    
    if (isOnline) {
      loadProjects()
    }
  }, [isOnline])
  
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
              <div className="flex items-center justify-center gap-2 text-blue-100">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm">Aktiv seit {new Date(activeTime.segment!.started_at).toLocaleTimeString('de-DE')}</span>
              </div>
              {activeTime.segment?.project_name && (
                <div className="mt-2 text-sm font-medium">
                  {activeTime.segment.project_name}
                </div>
              )}
              {activeTime.segment?.customer_name && (
                <div className="text-xs text-blue-200">
                  {activeTime.segment.customer_name}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">Bereit</div>
              <div className="text-blue-100 text-sm">
                Zeiterfassung ist bereit zum Start
              </div>
            </div>
          )}
        </div>
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
                {/* Project Selection */}
                <div className="space-y-2">
                  <Label htmlFor="mobile-project">Projekt auswählen</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Projekt wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex flex-col items-start py-1">
                            <span className="font-medium">{project.name}</span>
                            {project.customer && (
                              <span className="text-sm text-muted-foreground">
                                {project.customer.name}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                
                {/* Start Button */}
                <Button 
                  onClick={handleStart}
                  disabled={!selectedProject || isLoading}
                  size="lg"
                  className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <Play className="h-6 w-6 mr-2" />
                  Zeiterfassung starten
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
                      <SheetContent side="bottom" className="h-[80vh]">
                        <SheetHeader className="text-left pb-4">
                          <SheetTitle>Projekt wechseln</SheetTitle>
                          <SheetDescription>
                            Wählen Sie ein neues Projekt aus. Die aktuelle Erfassung wird automatisch beendet.
                          </SheetDescription>
                        </SheetHeader>
                        
                        <div className="space-y-4">
                          {/* New Project Selection */}
                          <div className="space-y-2">
                            <Label>Neues Projekt</Label>
                            <Select value={selectedProject} onValueChange={setSelectedProject}>
                              <SelectTrigger className="h-12 text-base">
                                <SelectValue placeholder="Neues Projekt wählen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    <div className="flex flex-col items-start py-1">
                                      <span className="font-medium">{project.name}</span>
                                      {project.customer && (
                                        <span className="text-sm text-muted-foreground">
                                          {project.customer.name}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
    </div>
  )
}

export default MobileTimeTracker