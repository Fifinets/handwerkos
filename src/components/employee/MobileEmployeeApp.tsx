import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Clock, 
  Package, 
  MapPin, 
  Camera, 
  CheckCircle,
  Play,
  Pause,
  Square,
  Navigation,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  Home,
  List,
  User,
  Bell,
  Settings as SettingsIcon,
  Upload,
  MessageSquare,
  ImageIcon,
  Receipt,
  Plus,
  X
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import MobileOnboarding from "./MobileOnboarding";

interface Project {
  id: string;
  name: string;
  status: string;
  location: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo: string[];
  deadline?: string;
}

interface TimeEntry {
  id: string;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  location?: {lat: number, lng: number, address: string};
  description?: string;
}

interface ProjectPhoto {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  description?: string;
  createdAt: Date;
}

interface ProjectReceipt {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  amount?: number;
  description?: string;
  createdAt: Date;
}

interface ProjectComment {
  id: string;
  projectId: string;
  comment: string;
  createdAt: Date;
}

const MobileEmployeeApp: React.FC = () => {
  const { user, userRole } = useSupabaseAuth();
  const { toast } = useToast();
  
  // State Management
  const [currentView, setCurrentView] = useState<'home' | 'projects' | 'time' | 'activity' | 'profile'>('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  
  // New states for photo, receipt and comment functionality
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<ProjectPhoto[]>([]);
  const [projectReceipts, setProjectReceipts] = useState<ProjectReceipt[]>([]);
  const [projectComments, setProjectComments] = useState<ProjectComment[]>([]);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [photoDescription, setPhotoDescription] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [commentText, setCommentText] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [notifications, setNotifications] = useState<number>(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  // Quick Actions State
  const [quickMaterialEntry, setQuickMaterialEntry] = useState({
    projectId: '',
    material: '',
    quantity: '',
    unit: 'Stück'
  });

  // Effects
  useEffect(() => {
    // Network status monitoring
    const handleOnline = () => {
      setIsOnline(true);
      // Sync when coming back online
      syncTimeEntries();
      syncMaterialEntries();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get initial location
    getCurrentLocation();

    // Mock battery API (for real apps use navigator.getBattery())
    const updateBattery = () => {
      setBatteryLevel(Math.max(20, Math.floor(Math.random() * 100)));
    };
    const batteryInterval = setInterval(updateBattery, 30000);

    // Load assigned projects
    fetchAssignedProjects();

    // Load existing data
    loadExistingData();

    // Check if first visit
    const hasSeenOnboarding = localStorage.getItem('handwerkos-onboarding-completed');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    } else {
      setIsFirstVisit(false);
    }

    // Check for active time entry in localStorage
    const storedActiveEntry = localStorage.getItem('activeTimeEntry');
    if (storedActiveEntry) {
      setActiveTimeEntry(JSON.parse(storedActiveEntry));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(batteryInterval);
      stopCamera();
    };
  }, []);

  // Geolocation functions
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Mock reverse geocoding - in real app use proper service
          setCurrentLocation({
            lat: latitude,
            lng: longitude,
            address: "Baustelle Musterstraße 123, 12345 Berlin"
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: "Standort",
            description: "Standort konnte nicht ermittelt werden",
            variant: "destructive"
          });
        },
        { enableHighAccuracy: true }
      );
    }
  };

  // Load existing data from database
  const loadExistingData = async () => {
    if (!user?.id || !isOnline) return;
    
    try {
      // Load existing photos for current user's projects
      const { data: photos } = await supabase
        .from('project_documents')
        .select('*')
        .eq('document_type', 'photo')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (photos) {
        const photoData: ProjectPhoto[] = photos.map(photo => ({
          id: photo.id,
          projectId: photo.project_id,
          fileName: photo.name,
          fileUrl: photo.file_url || '',
          description: photo.metadata?.description || '',
          createdAt: new Date(photo.created_at)
        }));
        setCapturedPhotos(photoData);
      }

      // Load existing receipts
      const { data: receipts } = await supabase
        .from('project_documents')
        .select('*')
        .eq('document_type', 'receipt')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (receipts) {
        const receiptData: ProjectReceipt[] = receipts.map(receipt => ({
          id: receipt.id,
          projectId: receipt.project_id,
          fileName: receipt.name,
          fileUrl: receipt.file_url || '',
          amount: receipt.metadata?.amount || 0,
          description: receipt.metadata?.description || '',
          createdAt: new Date(receipt.created_at)
        }));
        setProjectReceipts(receiptData);
      }

      // Load existing comments
      const { data: comments } = await supabase
        .from('project_comments')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (comments) {
        const commentData: ProjectComment[] = comments.map(comment => ({
          id: comment.id,
          projectId: comment.project_id,
          comment: comment.comment,
          createdAt: new Date(comment.created_at)
        }));
        setProjectComments(commentData);
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

  // Project management
  const fetchAssignedProjects = async () => {
    if (!user?.id) return;
    
    try {
      // Fetch projects where the current user is assigned
      const { data: teamAssignments, error } = await supabase
        .from('project_team_assignments')
        .select(`
          project_id,
          projects:project_id (
            id,
            name,
            status,
            location,
            start_date,
            end_date,
            priority
          )
        `)
        .eq('employee_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching assigned projects:', error);
        toast({
          title: "Fehler",
          description: "Projekte konnten nicht geladen werden",
          variant: "destructive"
        });
        return;
      }

      // Transform the data to match our Project interface
      const projects: Project[] = teamAssignments?.map((assignment: any) => ({
        id: assignment.projects.id,
        name: assignment.projects.name,
        status: assignment.projects.status || 'in_bearbeitung',
        location: assignment.projects.location || 'Nicht angegeben',
        priority: assignment.projects.priority || 'normal',
        assignedTo: [user.id],
        deadline: assignment.projects.end_date
      })) || [];

      setAssignedProjects(projects);
      setNotifications(projects.filter(p => p.priority === 'urgent').length);
    } catch (error) {
      console.error('Error in fetchAssignedProjects:', error);
      setAssignedProjects([]);
    }
  };

  // Camera and photo functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Kamera Fehler",
        description: "Kamera konnte nicht gestartet werden",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !activeProjectId) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      // Convert to blob and upload
      canvas.toBlob(async (blob) => {
        if (blob) {
          await uploadPhoto(blob, activeProjectId);
        }
      }, 'image/jpeg');
    }
    stopCamera();
  };

  const uploadPhoto = async (photoBlob: Blob, projectId: string) => {
    try {
      const fileName = `project-photo-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-media')
        .upload(`${projectId}/${fileName}`, photoBlob);

      if (uploadError) throw uploadError;

      // Save photo record to database
      const { data, error } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          name: fileName,
          document_type: 'photo',
          file_url: uploadData.path,
          created_by: user?.id,
          metadata: {
            description: photoDescription
          }
        });

      if (error) throw error;

      const newPhoto: ProjectPhoto = {
        id: data[0]?.id || Date.now().toString(),
        projectId: projectId,
        fileName: fileName,
        fileUrl: uploadData.path,
        description: photoDescription,
        createdAt: new Date()
      };

      setCapturedPhotos(prev => [...prev, newPhoto]);
      setPhotoDescription('');
      setShowPhotoDialog(false);

      toast({
        title: "Foto hochgeladen",
        description: "Foto wurde erfolgreich gespeichert"
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Upload Fehler", 
        description: "Foto konnte nicht hochgeladen werden",
        variant: "destructive"
      });
    }
  };

  const uploadReceipt = async (file: File, projectId: string) => {
    try {
      const fileName = `receipt-${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-media')
        .upload(`${projectId}/${fileName}`, file);

      if (uploadError) throw uploadError;

      // Save receipt record to database
      const { data, error } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          name: fileName,
          document_type: 'receipt',
          file_url: uploadData.path,
          created_by: user?.id,
          metadata: {
            amount: parseFloat(receiptAmount) || 0,
            description: receiptDescription
          }
        });

      if (error) throw error;

      const newReceipt: ProjectReceipt = {
        id: data[0]?.id || Date.now().toString(),
        projectId: projectId,
        fileName: fileName,
        fileUrl: uploadData.path,
        amount: parseFloat(receiptAmount) || 0,
        description: receiptDescription,
        createdAt: new Date()
      };

      setProjectReceipts(prev => [...prev, newReceipt]);
      setReceiptDescription('');
      setReceiptAmount('');
      setShowReceiptDialog(false);

      toast({
        title: "Rechnung hochgeladen",
        description: "Rechnung wurde erfolgreich gespeichert"
      });
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: "Upload Fehler",
        description: "Rechnung konnte nicht hochgeladen werden", 
        variant: "destructive"
      });
    }
  };

  const addComment = async (projectId: string, comment: string) => {
    try {
      const { data, error } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          comment: comment,
          created_by: user?.id
        });

      if (error) throw error;

      const newComment: ProjectComment = {
        id: data[0]?.id || Date.now().toString(),
        projectId: projectId,
        comment: comment,
        createdAt: new Date()
      };

      setProjectComments(prev => [...prev, newComment]);
      setCommentText('');
      setShowCommentDialog(false);

      toast({
        title: "Kommentar hinzugefügt",
        description: "Kommentar wurde erfolgreich gespeichert"
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gespeichert werden",
        variant: "destructive"
      });
    }
  };

  // Time tracking functions
  const startTimeTracking = (projectId: string) => {
    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      projectId,
      startTime: new Date(),
      isActive: true,
      location: currentLocation || undefined
    };
    
    setActiveTimeEntry(newEntry);
    
    // Store in localStorage for offline capability
    localStorage.setItem('activeTimeEntry', JSON.stringify(newEntry));
    
    toast({
      title: "Zeiterfassung gestartet",
      description: `Timer läuft für ${assignedProjects.find(p => p.id === projectId)?.name}`,
    });
  };

  const pauseTimeTracking = () => {
    if (activeTimeEntry) {
      const pausedEntry = {
        ...activeTimeEntry,
        isActive: false
      };
      setActiveTimeEntry(pausedEntry);
      localStorage.setItem('activeTimeEntry', JSON.stringify(pausedEntry));
      
      toast({
        title: "Zeiterfassung pausiert",
        description: "Timer angehalten"
      });
    }
  };

  const stopTimeTracking = () => {
    if (activeTimeEntry) {
      const completedEntry = {
        ...activeTimeEntry,
        endTime: new Date(),
        isActive: false
      };
      
      // Store completed entry (offline-capable)
      const storedEntries = JSON.parse(localStorage.getItem('completedTimeEntries') || '[]');
      storedEntries.push(completedEntry);
      localStorage.setItem('completedTimeEntries', JSON.stringify(storedEntries));
      
      setActiveTimeEntry(null);
      localStorage.removeItem('activeTimeEntry');
      
      const duration = Math.round((completedEntry.endTime!.getTime() - completedEntry.startTime.getTime()) / (1000 * 60));
      
      toast({
        title: "Zeiterfassung beendet",
        description: `${duration} Minuten erfasst`
      });

      // Sync to server when online
      if (isOnline) {
        syncTimeEntries();
      }
    }
  };

  const syncTimeEntries = async () => {
    const storedEntries = JSON.parse(localStorage.getItem('completedTimeEntries') || '[]');
    if (storedEntries.length > 0 && isOnline && user) {
      try {
        // Get employee ID first
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!employee) {
          console.error('Employee not found for user');
          return;
        }

        // Insert time entries to database
        const timeEntriesToInsert = storedEntries.map((entry: any) => ({
          employee_id: employee.id,
          project_id: entry.projectId,
          start_time: entry.startTime,
          end_time: entry.endTime,
          status: 'beendet',
          description: entry.description || null
        }));

        const { error } = await supabase
          .from('time_entries')
          .insert(timeEntriesToInsert);

        if (error) throw error;

        localStorage.removeItem('completedTimeEntries');
        
        toast({
          title: "Synchronisation",
          description: `${storedEntries.length} Zeiteinträge synchronisiert`
        });
      } catch (error) {
        console.error('Sync failed:', error);
        toast({
          title: "Sync Fehler",
          description: "Zeiterfassung konnte nicht synchronisiert werden",
          variant: "destructive"
        });
      }
    }
  };


  // Quick material entry
  const submitQuickMaterial = () => {
    if (!quickMaterialEntry.material || !quickMaterialEntry.quantity) {
      toast({
        title: "Fehler",
        description: "Material und Menge sind erforderlich",
        variant: "destructive"
      });
      return;
    }

    const entry = {
      ...quickMaterialEntry,
      timestamp: new Date().toISOString(),
      location: currentLocation
    };

    // Store offline if needed
    const storedMaterials = JSON.parse(localStorage.getItem('materialEntries') || '[]');
    storedMaterials.push(entry);
    localStorage.setItem('materialEntries', JSON.stringify(storedMaterials));

    // Reset form
    setQuickMaterialEntry({
      projectId: '',
      material: '',
      quantity: '',
      unit: 'Stück'
    });

    toast({
      title: "Material erfasst",
      description: `${entry.quantity} ${entry.unit} ${entry.material}`
    });

    if (isOnline) {
      syncMaterialEntries();
    }
  };

  const syncMaterialEntries = async () => {
    const storedMaterials = JSON.parse(localStorage.getItem('materialEntries') || '[]');
    if (storedMaterials.length > 0 && isOnline && user) {
      try {
        // Get employee ID first
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!employee) {
          console.error('Employee not found for user');
          return;
        }

        // Insert material usage entries to database
        const materialEntriesToInsert = storedMaterials.map((entry: any) => ({
          employee_id: employee.id,
          project_id: entry.projectId,
          material_id: null, // Will need to match material by name later
          quantity_used: parseFloat(entry.quantity),
          usage_date: new Date(entry.timestamp).toISOString().split('T')[0],
          notes: `${entry.material} (${entry.unit}) - Mobile Entry`,
          created_by: user.id
        }));

        const { error } = await supabase
          .from('employee_material_usage')
          .insert(materialEntriesToInsert);

        if (error) throw error;

        localStorage.removeItem('materialEntries');
        
        toast({
          title: "Synchronisation",
          description: `${storedMaterials.length} Materialeinträge synchronisiert`
        });
      } catch (error) {
        console.error('Material sync failed:', error);
        toast({
          title: "Sync Fehler",
          description: "Materialeinträge konnten nicht synchronisiert werden",
          variant: "destructive"
        });
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Dringend';
      case 'high': return 'Hoch';
      case 'normal': return 'Normal';
      case 'low': return 'Niedrig';
      default: return 'Normal';
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('handwerkos-onboarding-completed', 'true');
    setShowOnboarding(false);
    setIsFirstVisit(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('handwerkos-onboarding-completed', 'true');
    setShowOnboarding(false);
    setIsFirstVisit(false);
  };

  const getActiveTime = () => {
    if (!activeTimeEntry) return '00:00:00';
    
    const now = new Date();
    const diff = now.getTime() - activeTimeEntry.startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Render functions for different views
  const renderHomeView = () => (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold">Willkommen zurück!</h3>
              <p className="text-blue-100 text-sm">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Signal className="h-4 w-4" />
                <span className="text-xs">4G</span>
              </div>
              <div className="flex items-center gap-1">
                <Battery className="h-4 w-4" />
                <span className="text-xs">{batteryLevel}%</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? (
              <><Wifi className="h-4 w-4" /><span className="text-sm">Online</span></>
            ) : (
              <><WifiOff className="h-4 w-4" /><span className="text-sm">Offline</span></>
            )}
          </div>
          
          {currentLocation && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{currentLocation.address}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Time Tracking */}
      {activeTimeEntry && (
        <Card className="border-2 border-green-400 bg-green-50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-green-800">Timer läuft</h3>
              <div className="text-2xl font-mono font-bold text-green-600">
                {getActiveTime()}
              </div>
            </div>
            <p className="text-green-700 text-sm mb-3">
              {assignedProjects.find(p => p.id === activeTimeEntry.projectId)?.name}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={pauseTimeTracking}
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={stopTimeTracking}
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stoppen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Schnellaktionen</span>
            {notifications > 0 && (
              <Badge variant="destructive" className="rounded-full px-2 py-1">
                {notifications}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Button
            className="h-20 flex flex-col gap-2"
            onClick={() => setCurrentView('time')}
          >
            <Clock className="h-6 w-6" />
            <span className="text-sm">Zeit erfassen</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2"
            onClick={startCamera}
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm">Foto machen</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2"
            onClick={() => setCurrentView('projects')}
          >
            <List className="h-6 w-6" />
            <span className="text-sm">Projekte</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-20 flex flex-col gap-2"
            onClick={getCurrentLocation}
          >
            <Navigation className="h-6 w-6" />
            <span className="text-sm">Standort</span>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Material Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Schnell-Material
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={quickMaterialEntry.projectId}
            onChange={(e) => setQuickMaterialEntry(prev => ({
              ...prev,
              projectId: e.target.value
            }))}
            className="w-full p-2 border rounded-md text-sm"
          >
            <option value="">Projekt wählen...</option>
            {assignedProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Material..."
              value={quickMaterialEntry.material}
              onChange={(e) => setQuickMaterialEntry(prev => ({
                ...prev,
                material: e.target.value
              }))}
              className="p-2 border rounded-md text-sm"
            />
            <div className="flex gap-1">
              <input
                type="number"
                placeholder="Menge"
                value={quickMaterialEntry.quantity}
                onChange={(e) => setQuickMaterialEntry(prev => ({
                  ...prev,
                  quantity: e.target.value
                }))}
                className="p-2 border rounded-md text-sm flex-1"
              />
              <select
                value={quickMaterialEntry.unit}
                onChange={(e) => setQuickMaterialEntry(prev => ({
                  ...prev,
                  unit: e.target.value
                }))}
                className="p-2 border rounded-md text-sm w-20"
              >
                <option value="Stück">Stk</option>
                <option value="Meter">m</option>
                <option value="kg">kg</option>
                <option value="Liter">L</option>
              </select>
            </div>
          </div>
          
          <Button
            onClick={submitQuickMaterial}
            disabled={!quickMaterialEntry.material || !quickMaterialEntry.quantity}
            className="w-full"
            size="sm"
          >
            Material erfassen
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderProjectsView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Meine Projekte</h3>
        <Badge variant="outline">
          {assignedProjects.length} aktiv
        </Badge>
      </div>

      {assignedProjects.map(project => (
        <Card key={project.id} className="relative">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold text-sm">{project.name}</h4>
                <p className="text-gray-600 text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {project.location}
                </p>
              </div>
              <Badge
                className={`${getPriorityColor(project.priority)} text-white text-xs`}
              >
                {getPriorityLabel(project.priority)}
              </Badge>
            </div>
            
            {project.deadline && (
              <p className="text-xs text-orange-600 mb-3">
                Fällig: {new Date(project.deadline).toLocaleDateString('de-DE')}
              </p>
            )}
            
            <div className="flex gap-1 mb-2">
              <Button
                size="sm"
                onClick={() => startTimeTracking(project.id)}
                disabled={!!activeTimeEntry}
                className="flex-1"
              >
                <Play className="h-3 w-3 mr-1" />
                Zeit starten
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setActiveProjectId(project.id);
                  startCamera();
                }}
                className="flex-1"
              >
                <Camera className="h-3 w-3 mr-1" />
                Foto
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setActiveProjectId(project.id);
                  setShowReceiptDialog(true);
                }}
                className="flex-1"
              >
                <Receipt className="h-3 w-3 mr-1" />
                Rechnung
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setActiveProjectId(project.id);
                  setShowCommentDialog(true);
                }}
                className="flex-1"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Notiz
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderTimeView = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Zeiterfassung</h3>
      
      {activeTimeEntry ? (
        <Card className="border-2 border-green-400 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-mono font-bold text-green-600 mb-2">
              {getActiveTime()}
            </div>
            <p className="text-green-700 mb-4">
              {assignedProjects.find(p => p.id === activeTimeEntry.projectId)?.name}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={pauseTimeTracking}
                className="flex-1"
                variant="outline"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button
                onClick={stopTimeTracking}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stoppen
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3">Projekt auswählen:</h4>
            <div className="space-y-2">
              {assignedProjects.map(project => (
                <Button
                  key={project.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => startTimeTracking(project.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {project.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderActivityView = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Meine Aktivitäten</h3>
      
      {/* Recent Photos */}
      {capturedPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Fotos ({capturedPhotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {capturedPhotos.slice(0, 3).map(photo => (
              <div key={photo.id} className="flex justify-between items-center text-sm">
                <span className="truncate">
                  {assignedProjects.find(p => p.id === photo.projectId)?.name || 'Unbekanntes Projekt'}
                </span>
                <span className="text-gray-500">
                  {photo.createdAt.toLocaleDateString('de-DE')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Recent Receipts */}
      {projectReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Rechnungen ({projectReceipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectReceipts.slice(0, 3).map(receipt => (
              <div key={receipt.id} className="flex justify-between items-center text-sm">
                <div>
                  <span className="block truncate">
                    {assignedProjects.find(p => p.id === receipt.projectId)?.name || 'Unbekanntes Projekt'}
                  </span>
                  {receipt.amount > 0 && (
                    <span className="text-green-600 font-medium">€{receipt.amount.toFixed(2)}</span>
                  )}
                </div>
                <span className="text-gray-500">
                  {receipt.createdAt.toLocaleDateString('de-DE')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Recent Comments */}
      {projectComments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notizen ({projectComments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectComments.slice(0, 3).map(comment => (
              <div key={comment.id} className="text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">
                    {assignedProjects.find(p => p.id === comment.projectId)?.name || 'Unbekanntes Projekt'}
                  </span>
                  <span className="text-gray-500">
                    {comment.createdAt.toLocaleDateString('de-DE')}
                  </span>
                </div>
                <p className="text-gray-700 truncate">{comment.comment}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Offline Data */}
      {!isOnline && (
        <Card className="border-orange-400 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-700">Offline Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Zeiteinträge:</span>
              <span className="font-medium">
                {JSON.parse(localStorage.getItem('completedTimeEntries') || '[]').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Materialeinträge:</span>
              <span className="font-medium">
                {JSON.parse(localStorage.getItem('materialEntries') || '[]').length}
              </span>
            </div>
            <p className="text-orange-600 text-xs mt-2">
              Wird bei nächster Verbindung synchronisiert
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {capturedPhotos.length === 0 && projectReceipts.length === 0 && projectComments.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <List className="h-12 w-12 mx-auto" />
            </div>
            <h4 className="font-medium text-gray-700 mb-2">Keine Aktivitäten</h4>
            <p className="text-gray-500 text-sm">
              Ihre Projektaktivitäten werden hier angezeigt
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderProfileView = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Profil</h3>
      
      <Card>
        <CardContent className="p-4">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <User className="h-8 w-8 text-white" />
            </div>
            <h4 className="font-semibold">{user?.email}</h4>
            <p className="text-gray-600 text-sm">Mitarbeiter</p>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Status:</span>
              <Badge variant="outline" className="text-green-600">
                Aktiv
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Standort:</span>
              <span className="text-gray-600">
                {currentLocation ? 'Verfügbar' : 'Nicht verfügbar'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Offline-Daten:</span>
              <span className="text-gray-600">
                {JSON.parse(localStorage.getItem('completedTimeEntries') || '[]').length} Einträge
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isOnline && (
        <Card className="border-orange-400 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <WifiOff className="h-4 w-4" />
              <span className="font-medium">Offline-Modus</span>
            </div>
            <p className="text-orange-600 text-sm mt-1">
              Daten werden bei nächster Verbindung synchronisiert.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Show onboarding for first-time users
  if (showOnboarding && isFirstVisit) {
    return (
      <MobileOnboarding 
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Main Content */}
      <div className="flex-1 p-4 pb-20">
        {currentView === 'home' && renderHomeView()}
        {currentView === 'projects' && renderProjectsView()}
        {currentView === 'time' && renderTimeView()}
        {currentView === 'activity' && renderActivityView()}
        {currentView === 'profile' && renderProfileView()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t shadow-lg">
        <div className="grid grid-cols-5 gap-1 p-2">
          {[
            { id: 'home', icon: Home, label: 'Start' },
            { id: 'projects', icon: List, label: 'Projekte' },
            { id: 'time', icon: Clock, label: 'Zeit' },
            { id: 'activity', icon: Bell, label: 'Aktivität' },
            { id: 'profile', icon: User, label: 'Profil' }
          ].map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView(item.id as any)}
              className="flex flex-col gap-1 h-16 p-2"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
              {item.id === 'projects' && notifications > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 rounded-full w-4 h-4 p-0 text-xs"
                >
                  {notifications}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>


      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
            <Button
              onClick={takePhoto}
              className="bg-white text-black hover:bg-gray-200 rounded-full w-16 h-16"
            >
              <Camera className="h-8 w-8" />
            </Button>
            <Button
              onClick={stopCamera}
              variant="outline"
              className="bg-white text-black hover:bg-gray-200 rounded-full w-16 h-16"
            >
              <X className="h-8 w-8" />
            </Button>
          </div>
        </div>
      )}

      {/* Receipt Upload Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechnung hochladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Datei auswählen
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Betrag (optional)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Beschreibung (optional)
              </label>
              <Textarea
                placeholder="Beschreibung der Rechnung..."
                value={receiptDescription}
                onChange={(e) => setReceiptDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const file = fileInputRef.current?.files?.[0];
                  if (file && activeProjectId) {
                    uploadReceipt(file, activeProjectId);
                  }
                }}
                disabled={!fileInputRef.current?.files?.[0]}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Hochladen
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReceiptDialog(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notiz hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Kommentar
              </label>
              <Textarea
                placeholder="Ihre Notiz zum Projekt..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (commentText.trim() && activeProjectId) {
                    addComment(activeProjectId, commentText.trim());
                  }
                }}
                disabled={!commentText.trim()}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Hinzufügen
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCommentDialog(false);
                  setCommentText('');
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileEmployeeApp;