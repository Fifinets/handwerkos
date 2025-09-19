import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, 
  Plus, 
  Send, 
  Download, 
  Eye, 
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Filter,
  Search,
  MoreHorizontal,
  Edit3,
  Trash2,
  PenTool
} from "lucide-react"
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes"
import { useTimeTracking } from "@/hooks/useTimeTracking"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { de } from "date-fns/locale"

interface Project {
  id: string
  name: string
  customer: {
    id: string
    name: string
    email: string | null
  }
}

interface CreateDeliveryNoteForm {
  projectId: string
  customerId: string
  deliveryDate: Date
  timeSegmentIds: string[]
  materialItems: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice?: number
  }>
  deliveryAddress?: any
}

const DeliveryNotesManager: React.FC = () => {
  const {
    deliveryNotes,
    isLoading,
    isCreating,
    fetchDeliveryNotes,
    createDeliveryNote,
    signDeliveryNote
  } = useDeliveryNotes()
  
  // Note: These functions might not be available yet in the hook
  const generatePDF = () => console.log('PDF generation not implemented')
  const sendEmail = () => console.log('Email sending not implemented')
  const updateStatus = () => console.log('Status update not implemented')
  const applyTimeRules = () => console.log('Time rules not implemented')
  const fetchDeliveryNote = () => console.log('Single delivery note fetch not implemented')
  
  const { segments, fetchTimeSegments } = useTimeTracking()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedNote, setSelectedNote] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsSheet, setShowDetailsSheet] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form state
  const [form, setForm] = useState<CreateDeliveryNoteForm>({
    projectId: '',
    customerId: '',
    deliveryDate: new Date(),
    timeSegmentIds: [],
    materialItems: [],
    deliveryAddress: null
  })
  
  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            customer:customers(
              id,
              name,
              email
            )
          `)
          .eq('status', 'active')
          .order('name')
        
        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error('Error loading projects:', error)
        toast.error('Fehler beim Laden der Projekte')
      }
    }
    
    loadProjects()
    fetchTimeSegments()
  }, [fetchTimeSegments])
  
  // Filter delivery notes
  const filteredNotes = deliveryNotes.filter(note => {
    const matchesStatus = filterStatus === 'all' || note.status === filterStatus
    const matchesSearch = searchQuery === '' || 
      note.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.project?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.project?.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })
  
  // Status colors and labels
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return { color: 'bg-gray-500', label: 'Entwurf', icon: Edit3 }
      case 'sent':
        return { color: 'bg-blue-500', label: 'Versendet', icon: Mail }
      case 'signed':
        return { color: 'bg-green-500', label: 'Signiert', icon: CheckCircle2 }
      case 'cancelled':
        return { color: 'bg-red-500', label: 'Storniert', icon: XCircle }
      default:
        return { color: 'bg-gray-500', label: status, icon: AlertCircle }
    }
  }
  
  // Handle create delivery note
  const handleCreate = async () => {
    try {
      if (!form.projectId || !form.customerId) {
        toast.error('Bitte wählen Sie ein Projekt aus')
        return
      }
      
      await createDeliveryNote({
        projectId: form.projectId,
        customerId: form.customerId,
        deliveryDate: format(form.deliveryDate, 'yyyy-MM-dd'),
        timeSegmentIds: form.timeSegmentIds.length > 0 ? form.timeSegmentIds : undefined,
        materialItems: form.materialItems.length > 0 ? form.materialItems : undefined,
        deliveryAddress: form.deliveryAddress
      })
      
      setShowCreateDialog(false)
      resetForm()
      
    } catch (error) {
      // Error is already handled in the hook
    }
  }
  
  // Reset form
  const resetForm = () => {
    setForm({
      projectId: '',
      customerId: '',
      deliveryDate: new Date(),
      timeSegmentIds: [],
      materialItems: [],
      deliveryAddress: null
    })
  }
  
  // Handle view details
  const handleViewDetails = async (noteId: string) => {
    try {
      const note = await fetchDeliveryNote(noteId)
      setSelectedNote(note)
      setShowDetailsSheet(true)
    } catch (error) {
      // Error already handled in hook
    }
  }
  
  // Add material item
  const addMaterialItem = () => {
    setForm(prev => ({
      ...prev,
      materialItems: [...prev.materialItems, {
        description: '',
        quantity: 1,
        unit: 'Stk',
        unitPrice: undefined
      }]
    }))
  }
  
  // Remove material item
  const removeMaterialItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      materialItems: prev.materialItems.filter((_, i) => i !== index)
    }))
  }
  
  // Update material item
  const updateMaterialItem = (index: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      materialItems: prev.materialItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }
  
  // Get available time segments for selected project
  const getAvailableTimeSegments = () => {
    if (!form.projectId) return []
    
    return segments.filter(segment => 
      segment.project_id === form.projectId &&
      segment.status === 'completed' &&
      segment.ended_at !== null
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lieferscheine</h2>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Lieferscheine und Arbeitszeiten
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Lieferschein
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Neuen Lieferschein erstellen</DialogTitle>
              <DialogDescription>
                Erstellen Sie einen neuen Lieferschein mit Arbeitszeiten und Materialien
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList>
                <TabsTrigger value="basic">Grunddaten</TabsTrigger>
                <TabsTrigger value="time">Arbeitszeiten</TabsTrigger>
                <TabsTrigger value="materials">Materialien</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Projekt</Label>
                    <Select
                      value={form.projectId}
                      onValueChange={(value) => {
                        const project = projects.find(p => p.id === value)
                        setForm(prev => ({
                          ...prev,
                          projectId: value,
                          customerId: project?.customer.id || ''
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Projekt auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{project.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {project.customer.name}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="delivery-date">Lieferdatum</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(form.deliveryDate, 'PPP', { locale: de })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={form.deliveryDate}
                          onSelect={(date) => date && setForm(prev => ({ ...prev, deliveryDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="time" className="space-y-4">
                <div>
                  <Label>Arbeitszeiten hinzufügen</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {getAvailableTimeSegments().map((segment) => (
                      <div
                        key={segment.id}
                        className="flex items-center space-x-3 p-3 border rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={form.timeSegmentIds.includes(segment.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm(prev => ({
                                ...prev,
                                timeSegmentIds: [...prev.timeSegmentIds, segment.id]
                              }))
                            } else {
                              setForm(prev => ({
                                ...prev,
                                timeSegmentIds: prev.timeSegmentIds.filter(id => id !== segment.id)
                              }))
                            }
                          }}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="h-4 w-4" />
                            {format(new Date(segment.started_at), 'PPP', { locale: de })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(segment.started_at), 'HH:mm')} - {' '}
                            {segment.ended_at && format(new Date(segment.ended_at), 'HH:mm')} {' '}
                            ({segment.duration_minutes_computed || 0} Min)
                          </div>
                          {segment.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {segment.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline">
                          {segment.segment_type}
                        </Badge>
                      </div>
                    ))}
                    
                    {getAvailableTimeSegments().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Keine abgeschlossenen Arbeitszeiten gefunden</p>
                        <p className="text-sm">
                          {form.projectId ? 'Für dieses Projekt' : 'Wählen Sie zuerst ein Projekt aus'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="materials" className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Materialien</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMaterialItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Hinzufügen
                    </Button>
                  </div>
                  
                  <div className="mt-2 space-y-3">
                    {form.materialItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-2">
                            <Input
                              placeholder="Beschreibung"
                              value={item.description}
                              onChange={(e) => updateMaterialItem(index, 'description', e.target.value)}
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              placeholder="Menge"
                              value={item.quantity}
                              onChange={(e) => updateMaterialItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Einheit"
                              value={item.unit}
                              onChange={(e) => updateMaterialItem(index, 'unit', e.target.value)}
                              className="w-20"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeMaterialItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {form.materialItems.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Keine Materialien hinzugefügt</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMaterialItem}
                          className="mt-2"
                        >
                          Erstes Material hinzufügen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !form.projectId}>
                {isCreating ? 'Erstelle...' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <Label htmlFor="status-filter">Status:</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="sent">Versendet</SelectItem>
                    <SelectItem value="signed">Signiert</SelectItem>
                    <SelectItem value="cancelled">Storniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {filteredNotes.length} von {deliveryNotes.length} Lieferscheinen
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-muted-foreground">Lade Lieferscheine...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Lieferscheine gefunden</p>
              {searchQuery || filterStatus !== 'all' ? (
                <p className="text-sm mt-1">Versuchen Sie andere Filter oder Suchbegriffe</p>
              ) : (
                <p className="text-sm mt-1">Erstellen Sie Ihren ersten Lieferschein oben</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const statusConfig = getStatusConfig(note.status)
                const StatusIcon = statusConfig.icon
                
                return (
                  <Card key={note.id} className="transition-all hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`h-3 w-3 rounded-full ${statusConfig.color}`} />
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{note.number}</h3>
                              <Badge variant="outline">
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {note.project?.name || 'Kein Projekt'}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {note.project?.customer.name}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(note.delivery_date), 'PPP', { locale: de })}
                              </span>
                              {note.total_work_minutes > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {Math.floor(note.total_work_minutes / 60)}h {note.total_work_minutes % 60}m
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(note.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generatePDF(note.id)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                          
                          {note.project?.customer.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendEmail(note.id)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Senden
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Details Sheet */}
      <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
        <SheetContent className="w-full sm:w-[600px] sm:max-w-none">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedNote?.number}
            </SheetTitle>
            <SheetDescription>
              Lieferschein Details und Aktionen
            </SheetDescription>
          </SheetHeader>
          
          {selectedNote && (
            <div className="mt-6 space-y-6">
              {/* Status and Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">STATUS</Label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {getStatusConfig(selectedNote.status).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">DATUM</Label>
                  <div className="mt-1 text-sm">
                    {format(new Date(selectedNote.delivery_date), 'PPP', { locale: de })}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Project and Customer */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">PROJEKT</Label>
                  <div className="mt-1 font-medium">{selectedNote.project?.name}</div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">KUNDE</Label>
                  <div className="mt-1">
                    <div className="font-medium">{selectedNote.project?.customer.name}</div>
                    {selectedNote.project?.customer.email && (
                      <div className="text-sm text-muted-foreground">{selectedNote.project.customer.email}</div>
                    )}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Items */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground">POSITIONEN</Label>
                <div className="space-y-2">
                  {selectedNote.items?.map((item: any) => (
                    <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{item.description}</div>
                          {item.item_type === 'time' && item.time_segment && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(item.time_segment.started_at), 'HH:mm')} -{' '}
                              {item.time_segment.ended_at && format(new Date(item.time_segment.ended_at), 'HH:mm')}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{item.quantity} {item.unit}</div>
                          <Badge variant="outline" className="text-xs">
                            {item.item_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Time Summary */}
              {selectedNote.total_work_minutes > 0 && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">ARBEITSZEIT</Label>
                      <div className="mt-1 font-medium">
                        {Math.floor(selectedNote.total_work_minutes / 60)}h {selectedNote.total_work_minutes % 60}m
                      </div>
                    </div>
                    {selectedNote.total_break_minutes > 0 && (
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">PAUSENZEIT</Label>
                        <div className="mt-1 font-medium">
                          {Math.floor(selectedNote.total_break_minutes / 60)}h {selectedNote.total_break_minutes % 60}m
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Signature */}
              {selectedNote.signed_at && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">SIGNATUR</Label>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Signiert</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(selectedNote.signed_at), 'PPP p', { locale: de })}
                      </div>
                      {selectedNote.signed_by_name && (
                        <div className="text-sm text-muted-foreground">
                          von {selectedNote.signed_by_name}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => generatePDF(selectedNote.id)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                {selectedNote.project?.customer.email && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => sendEmail(selectedNote.id)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                )}
                {selectedNote.status !== 'signed' && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // Open signature dialog - implement as needed
                      toast.info('Signatur-Dialog öffnet sich...')
                    }}
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Signieren
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default DeliveryNotesManager