import React, { useState, useEffect, useCallback } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search,
  Clock,
  MapPin,
  Star,
  QrCode,
  Building,
  User,
  Calendar,
  Bookmark,
  Plus
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  customer?: {
    id?: string
    name: string
    phone?: string
  }
  location?: string
  color?: string
  status: string
  start_date?: string
  end_date?: string
  priority?: string
  description?: string
  last_used?: string
  is_favorite?: boolean
}

interface QuickProjectSwitchProps {
  isOpen: boolean
  onClose: () => void
  onProjectSelect: (projectId: string, projectData?: any) => void
  currentProjectId?: string
}

interface RecentProject {
  project_id: string
  project_name: string
  customer_name?: string
  last_used: string
  usage_count: number
}

export const QuickProjectSwitch: React.FC<QuickProjectSwitchProps> = ({
  isOpen,
  onClose,
  onProjectSelect,
  currentProjectId
}) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [favoriteProjects, setFavoriteProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'recent' | 'all' | 'favorites' | 'scan'>('recent')

  // Lade Projekte
  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    try {
      console.log('🔍 Loading projects from QuickProjectSwitch...')

      // Erst einfache Abfrage versuchen
      let { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .limit(5)

      console.log('📊 Basic project query result:', { data, error })

      if (error) {
        console.error('Basic query failed:', error)
        toast.error(`Basis-Abfrage fehlgeschlagen: ${error.message}`)
        setProjects([])
        return
      }

      // Wenn Basis funktioniert, erweiterte Abfrage versuchen
      if (data && data.length > 0) {
        console.log('📊 Basic query OK, trying extended query...')
        const { data: extendedData, error: extendedError } = await supabase
          .from('projects')
          .select(`
            id, name, status, location, color, customer_id, start_date, end_date, priority, description
          `)
          .not('status', 'eq', 'abgeschlossen')
          .not('status', 'eq', 'completed')
          .not('status', 'eq', 'cancelled')
          .not('status', 'eq', 'archiviert')
          .order('name')

        if (!extendedError && extendedData) {
          console.log('📊 Extended query successful:', extendedData.length, 'projects')
          console.log('📊 Sample extended data:', extendedData[0])
          data = extendedData

          // Lade Customer-Daten separat und verknüpfe sie
          try {
            const customerIds = [...new Set(data.map(p => p.customer_id).filter(Boolean))]
            console.log('📊 Customer IDs found:', customerIds)
            let customerMap = new Map()

            if (customerIds.length > 0) {
              const { data: customers } = await supabase
                .from('customers')
                .select('id, name, phone')
                .in('id', customerIds)

              console.log('📊 Customers loaded:', customers?.length || 0)
              if (customers) {
                customers.forEach(c => customerMap.set(c.id, c))
              }
            }

            // Add customer info to projects
            data = data.map(project => ({
              ...project,
              customer: project.customer_id && customerMap.has(project.customer_id)
                ? {
                    name: customerMap.get(project.customer_id).name,
                    phone: customerMap.get(project.customer_id).phone
                  }
                : null
            }))
          } catch (customerError) {
            console.log('📊 Customer loading failed, continuing without:', customerError)
          }
        } else {
          console.log('📊 Extended query failed, using basic data')
          console.error('📊 Extended query error details:', extendedError?.message || extendedError)
        }
      }

      console.log('📊 Final projects to set:', data?.length || 0)
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Lade zuletzt verwendete Projekte
  const loadRecentProjects = useCallback(async () => {
    try {
      // Simuliere Recent-Daten aus time_segments
      const { data, error } = await supabase
        .from('time_segments')
        .select(`
          project_id,
          started_at,
          project:projects(name, customer:customers(name))
        `)
        .not('project_id', 'is', null)
        .order('started_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Failed to load recent projects:', error)
        setRecentProjects([])
        return
      }

      // Gruppiere und zähle Verwendungen
      const recentMap = new Map<string, RecentProject>()
      data?.forEach(segment => {
        if (segment.project_id && segment.project) {
          const existing = recentMap.get(segment.project_id)
          if (existing) {
            existing.usage_count++
            if (segment.started_at > existing.last_used) {
              existing.last_used = segment.started_at
            }
          } else {
            recentMap.set(segment.project_id, {
              project_id: segment.project_id,
              project_name: segment.project.name,
              customer_name: segment.project.customer?.name,
              last_used: segment.started_at,
              usage_count: 1
            })
          }
        }
      })

      const recentArray = Array.from(recentMap.values())
        .sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime())
        .slice(0, 5)

      setRecentProjects(recentArray)
    } catch (error) {
      console.error('Error loading recent projects:', error)
    }
  }, [])

  // Lade Favoriten (falls implementiert)
  const loadFavoriteProjects = useCallback(async () => {
    // Placeholder für Favoriten-Funktionalität
    const favs = projects.filter(p => p.is_favorite)
    setFavoriteProjects(favs)
  }, [projects])

  useEffect(() => {
    if (isOpen) {
      loadProjects()
      loadRecentProjects()
    }
  }, [isOpen, loadProjects, loadRecentProjects])

  useEffect(() => {
    loadFavoriteProjects()
  }, [loadFavoriteProjects])

  // Filtere Projekte nach Suche
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.customer?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Projekt auswählen
  const handleProjectSelect = (projectId: string) => {
    // Find the full project data to pass along
    const fullProject = projects.find(p => p.id === projectId)
    if (fullProject) {
      // Pass both the ID and the full project data
      onProjectSelect(projectId, fullProject)
    } else {
      // Fallback to just ID if project not found
      onProjectSelect(projectId)
    }
  }

  // QR-Code Scanner (Placeholder)
  const handleQRScan = async () => {
    toast.info('QR-Code Scanner wird implementiert')
    // TODO: Implement QR code scanning with @capacitor/barcode-scanner
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Projekt wählen
          </SheetTitle>
          <SheetDescription>
            Wählen Sie ein Projekt für die Zeiterfassung
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Projekt oder Kunde suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="recent" className="text-xs">
                <Clock className="h-4 w-4 mr-1" />
                Zuletzt
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                <Building className="h-4 w-4 mr-1" />
                Alle
              </TabsTrigger>
              <TabsTrigger value="favorites" className="text-xs">
                <Star className="h-4 w-4 mr-1" />
                Favoriten
              </TabsTrigger>
              <TabsTrigger value="scan" className="text-xs">
                <QrCode className="h-4 w-4 mr-1" />
                Scan
              </TabsTrigger>
            </TabsList>

            {/* Recent Projects */}
            <TabsContent value="recent" className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentProjects.length > 0 ? (
                recentProjects.map((recent) => (
                  <Card
                    key={recent.project_id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      currentProjectId === recent.project_id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleProjectSelect(recent.project_id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{recent.project_name}</h3>
                            {currentProjectId === recent.project_id && (
                              <Badge variant="secondary">Aktiv</Badge>
                            )}
                          </div>
                          {recent.customer_name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {recent.customer_name}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(recent.last_used).toLocaleString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {recent.usage_count}x verwendet
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Keine zuletzt verwendeten Projekte</p>
                </div>
              )}
            </TabsContent>

            {/* All Projects */}
            <TabsContent value="all" className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <Card
                    key={project.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      currentProjectId === project.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleProjectSelect(project.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{project.name}</h3>
                            {currentProjectId === project.id && (
                              <Badge variant="secondary">Aktiv</Badge>
                            )}
                            {project.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                            )}
                          </div>
                          {project.customer && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {project.customer.name}
                            </p>
                          )}
                          {project.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {project.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>
                    {searchQuery ? 'Keine Projekte gefunden' : 'Noch keine Projekte erstellt'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs mt-2">
                      Erstellen Sie ein neues Projekt über die Schaltfläche unten
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Favorites */}
            <TabsContent value="favorites" className="space-y-2 max-h-[400px] overflow-y-auto">
              {favoriteProjects.length > 0 ? (
                favoriteProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => handleProjectSelect(project.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <div>
                          <h3 className="font-medium">{project.name}</h3>
                          {project.customer && (
                            <p className="text-sm text-muted-foreground">
                              {project.customer.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Noch keine Favoriten</p>
                  <p className="text-xs mt-1">Markieren Sie Projekte als Favoriten</p>
                </div>
              )}
            </TabsContent>

            {/* QR Scan */}
            <TabsContent value="scan" className="space-y-4">
              <div className="text-center py-8">
                <QrCode className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">QR-Code scannen</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Scannen Sie einen QR-Code um schnell zu einem Projekt zu wechseln
                </p>
                <Button onClick={handleQRScan} className="w-full">
                  <QrCode className="h-4 w-4 mr-2" />
                  Scanner starten
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Actions */}
          <div className="border-t pt-4">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {
                toast.info('Neues Projekt erstellen wird implementiert')
                // TODO: Navigate to create project form
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neues Projekt erstellen
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}