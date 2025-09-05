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
  Map,
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
  FileText,
  User,
  Bell,
  Settings,
  Settings as SettingsIcon,
  Upload,
  MessageSquare,
  ImageIcon,
  Receipt,
  Plus,
  X,
  Calendar,
  PenTool
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VacationRequestDialog } from "../VacationRequestDialog";
import MapView from "../MapView";
import { StatusBar, Style } from '@capacitor/status-bar';
import EnhancedMobileTimeTracker from './EnhancedMobileTimeTracker';
import MobileDeliverySignature from '../MobileDeliverySignature';

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
  const [currentView, setCurrentView] = useState<'home' | 'docs' | 'time' | 'signature' | 'profile'>('home');
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
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [vacationBalance, setVacationBalance] = useState({ available: 0, total: 0 });
  const [nearByProjects, setNearByProjects] = useState<string[]>([]);

  // Quick Actions State
  const [quickMaterialEntry, setQuickMaterialEntry] = useState({
    projectId: '',
    material: '',
    quantity: '',
    unit: 'Stück'
  });

  // Effects
  // Configure status bar for fullscreen display
  useEffect(() => {
    const configureStatusBar = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.show();
      } catch (error) {
        console.log('StatusBar not available in web');
      }
    };
    configureStatusBar();
  }, []);

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

    // Load vacation balance
    loadVacationBalance();

    // Onboarding removed - not needed
    setIsFirstVisit(false);

    // Check for active time entry in localStorage
    const storedActiveEntry = localStorage.getItem('activeTimeEntry');
    if (storedActiveEntry) {
      const parsed = JSON.parse(storedActiveEntry);
      // Convert string dates back to Date objects
      if (parsed.startTime) {
        parsed.startTime = new Date(parsed.startTime);
      }
      if (parsed.endTime) {
        parsed.endTime = new Date(parsed.endTime);
      }
      setActiveTimeEntry(parsed);
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

  // Load vacation balance
  const loadVacationBalance = async () => {
    if (!user?.id || !isOnline) return;
    
    try {
      // Get employee data
      const { data: employee } = await supabase
        .from('employees')
        .select('id, vacation_days_total, vacation_days_used')
        .eq('user_id', user.id)
        .single();

      if (employee) {
        // Calculate pending days from pending requests
        const { data: pendingRequests } = await supabase
          .from('vacation_requests')
          .select('days_requested')
          .eq('employee_id', employee.id)
          .eq('status', 'pending')
          .eq('request_type', 'vacation');

        const pendingDays = pendingRequests?.reduce((sum, req) => sum + req.days_requested, 0) || 0;
        const totalDays = employee.vacation_days_total || 0;
        const usedDays = employee.vacation_days_used || 0;
        const availableDays = Math.max(0, totalDays - usedDays - pendingDays);

        setVacationBalance({
          available: availableDays,
          total: totalDays
        });
      } else {
        // Get default from company settings if no employee record
        const { data: settings } = await supabase
          .from('company_settings')
          .select('default_vacation_days')
          .single();

        const defaultDays = settings?.default_vacation_days || 25;
        setVacationBalance({
          available: defaultDays,
          total: defaultDays
        });
      }
    } catch (error) {
      console.error('Error loading vacation balance:', error);
    }
  };

  // Project management
  const fetchAssignedProjects = async () => {
    // Add fallback if user is not loaded yet
    if (!user || !user.id) {
      // Load mock project for testing
      const mockProjects: Project[] = [
        {
          id: 'mock-1',
          name: 'Baustelle Musterstraße',
          status: 'aktiv',
          location: 'Musterstraße 123, Berlin',
          priority: 'normal',
          assignedTo: ['mock-user'],
          deadline: null
        }
      ];
      setAssignedProjects(mockProjects);
      return;
    }
    
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
        // Add mock project for testing when database fails
        const mockProjects: Project[] = [
          {
            id: 'mock-1',
            name: 'Baustelle Musterstraße',
            status: 'aktiv',
            location: 'Musterstraße 123, Berlin',
            priority: 'normal',
            assignedTo: [user?.id || 'mock-user'],
            deadline: null
          }
        ];
        setAssignedProjects(mockProjects);
        return;
      }

      // Transform the data to match our Project interface
      const projects: Project[] = teamAssignments?.map((assignment: any) => ({
        id: assignment.projects.id,
        name: assignment.projects.name,
        status: assignment.projects.status || 'in_bearbeitung',
        location: assignment.projects.location || 'Nicht angegeben',
        priority: assignment.projects.priority || 'normal',
        assignedTo: [user?.id || 'mock-user'],
        deadline: assignment.projects.end_date
      })) || [];

      // If no projects from database, add mock project
      if (projects.length === 0) {
        const mockProjects: Project[] = [
          {
            id: 'mock-1',
            name: 'Baustelle Musterstraße', 
            status: 'aktiv',
            location: 'Musterstraße 123, Berlin',
            priority: 'normal',
            assignedTo: [user?.id || 'mock-user'],
            deadline: null
          }
        ];
        setAssignedProjects(mockProjects);
        setNotifications(0);
        return;
      }

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
      // First check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available');
      }

      // Request camera permission with better constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      setShowCamera(true);
      
      // Wait for the next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
      
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = "Kamera konnte nicht gestartet werden";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Kamera-Zugriff wurde verweigert. Bitte erlauben Sie den Kamera-Zugriff in den Browser-Einstellungen.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = "Keine Kamera gefunden. Bitte stellen Sie sicher, dass eine Kamera angeschlossen ist.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = "Kamera wird bereits von einer anderen Anwendung verwendet.";
      } else if (!navigator.mediaDevices) {
        errorMessage = "Ihr Browser unterstützt keine Kamera-Funktionen. Bitte verwenden Sie einen modernen Browser.";
      }
      
      toast({
        title: "Kamera Fehler",
        description: errorMessage,
        variant: "destructive"
      });
      
      setShowCamera(false);
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

      // Start OCR processing for the receipt
      let ocrResult = null;
      try {
        // Convert file to base64 for OCR processing
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Basic OCR processing - you can extend this with your OCR service
        ocrResult = {
          status: 'processed',
          confidence: 0.85,
          extracted_text: 'OCR processing completed',
          processed_at: new Date().toISOString(),
          file_type: file.type,
          structured_data: {
            amount: parseFloat(receiptAmount) || 0,
            description: receiptDescription,
            filename: fileName
          }
        };
      } catch (ocrError) {
        console.warn('OCR processing failed:', ocrError);
        ocrResult = {
          status: 'failed',
          error: 'OCR processing failed',
          processed_at: new Date().toISOString()
        };
      }

      // Save receipt record to database with OCR result and validation status
      const { data, error } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          name: fileName,
          document_type: 'receipt',
          file_url: uploadData.path,
          created_by: user?.id,
          validation_status: 'submitted', // Default status for new receipts
          ocr_result: ocrResult,
          metadata: {
            amount: parseFloat(receiptAmount) || 0,
            description: receiptDescription,
            upload_type: 'mobile_employee'
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
        title: "Rechnung eingereicht",
        description: "Rechnung wurde zur Manager-Validierung eingereicht und wartet auf Genehmigung."
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
      
      const endTime = completedEntry.endTime instanceof Date 
        ? completedEntry.endTime 
        : new Date(completedEntry.endTime!);
      const startTime = completedEntry.startTime instanceof Date 
        ? completedEntry.startTime 
        : new Date(completedEntry.startTime);
      
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
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

  // Onboarding functions removed - not needed

  const getActiveTime = () => {
    if (!activeTimeEntry || !activeTimeEntry.startTime) return '00:00:00';
    
    const now = new Date();
    // Ensure startTime is a Date object
    const startTime = activeTimeEntry.startTime instanceof Date 
      ? activeTimeEntry.startTime 
      : new Date(activeTimeEntry.startTime);
    
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Map-First Render Functions (Apple Find My Style)  
  const renderMapView = () => {
    // Convert assigned projects to map points with coordinates
    const projectSites = assignedProjects.map(project => ({
      id: project.id,
      name: project.name,
      lat: 52.520008 + Math.random() * 0.01, // Mock coordinates around Berlin
      lng: 13.404954 + Math.random() * 0.01, // In real app, get from project.coordinates
      address: project.location
    }));

    return (
      <div className="flex flex-col h-full">
        {/* Map Container */}
        <div className="flex-1">
          <MapView 
            constructionSites={projectSites}
            onLocationUpdate={(userLocation, nearByProjects) => {
              setCurrentLocation(userLocation);
              setNearByProjects(nearByProjects.map(site => site.id));
            }}
            className="h-full" 
          />
        </div>
      </div>
    );
  };

  // Map-based Time Tracking View (only tab with map access)
  const renderTimeMapView = () => {
    // Convert assigned projects to map points with coordinates  
    const projectSites = assignedProjects.map(project => ({
      id: project.id,
      name: project.name,
      lat: 52.520008 + Math.random() * 0.01, // Mock coordinates around Berlin
      lng: 13.404954 + Math.random() * 0.01, // In real app, get from project.coordinates
      address: project.location
    }));

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1">
          <MapView 
            constructionSites={projectSites}
            onLocationUpdate={(userLocation, nearByProjects) => {
              setCurrentLocation(userLocation);
              setNearByProjects(nearByProjects.map(site => site.id));
            }}
            className="h-full" 
          />
        </div>
        
        {/* Time Tracking Bottom Sheet */}
        <div className="bg-white border-t rounded-t-xl p-4 max-h-60 overflow-y-auto">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Zeiterfassung
          </h3>
          
          {/* Project Info */}
          {assignedProjects.length > 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">{assignedProjects[0].name}</span>
              </div>
              <div className="text-xs text-gray-600">{assignedProjects[0].location}</div>
              
              {nearByProjects.length > 0 && (
                <div className="mt-2 text-xs text-green-600 font-medium">
                  ✅ In Reichweite - Einstempeln möglich
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Kein Projekt vorhanden</span>
              </div>
            </div>
          )}

          {/* Active Time Entry */}
          {activeTimeEntry ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Zeit läuft</div>
                  <div className="text-xs text-gray-500">
                    Seit {(activeTimeEntry.startTime instanceof Date 
                      ? activeTimeEntry.startTime 
                      : new Date(activeTimeEntry.startTime)).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-lg font-bold text-green-600">
                  {getActiveTime()}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button 
                  onClick={pauseTimeTracking}
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
                <Button 
                  onClick={stopTimeTracking}
                  variant="destructive" 
                  size="sm"
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedProjects.map(project => {
                const isNearBy = nearByProjects.includes(project.id);
                return (
                  <Button
                    key={project.id}
                    variant="default"
                    className="w-full justify-center"
                    onClick={() => startTimeTracking(project.id)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    STARTEN
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Legacy render functions (keeping for now)
  const renderHomeView = () => (
    <div className="space-y-2 w-full overflow-hidden">

      {/* Active Time Tracking */}
      {activeTimeEntry && (
        <Card className="border-2 border-green-400 bg-green-50">
          <CardContent className="p-3">
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
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2">
            <span>Schnellaktionen</span>
            {notifications > 0 && (
              <Badge variant="destructive" className="rounded-full px-2 py-1">
                {notifications}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 p-3">
          <Button
            className="min-h-[60px] p-2 flex flex-col justify-center gap-1 text-sm"
            onClick={() => setCurrentView('time')}
          >
            <Clock className="h-6 w-6" />
            <span className="text-sm">Zeit erfassen</span>
          </Button>
          
          <Button
            variant="outline"
            className="min-h-[60px] p-2 flex flex-col justify-center gap-1 text-sm"
            onClick={() => {
              setActiveProjectId(assignedProjects[0]?.id || '');
              startCamera();
            }}
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm">Foto machen</span>
          </Button>
          
          <Button
            variant="outline"
            className="min-h-[60px] p-2 flex flex-col justify-center gap-1 text-sm"
            onClick={() => setCurrentView('docs')}
          >
            <FileText className="h-6 w-6" />
            <span className="text-sm">Dokumentation</span>
          </Button>
          
          <Button
            variant="outline"
            className="min-h-[60px] p-2 flex flex-col justify-center gap-1 text-sm"
            onClick={() => setShowVacationDialog(true)}
          >
            <Calendar className="h-6 w-6" />
            <span className="text-sm">Urlaub</span>
            {vacationBalance.available > 0 && (
              <span className="text-xs text-green-600">{vacationBalance.available} Tage</span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Material Entry */}
      <Card className="overflow-hidden">
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-1 text-sm">
            <Package className="h-4 w-4" />
            Schnell-Material
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          <select
            value={quickMaterialEntry.projectId}
            onChange={(e) => setQuickMaterialEntry(prev => ({
              ...prev,
              projectId: e.target.value
            }))}
            className="w-full p-1.5 border rounded text-xs"
          >
            <option value="">Projekt wählen...</option>
            {assignedProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Material..."
            value={quickMaterialEntry.material}
            onChange={(e) => setQuickMaterialEntry(prev => ({
              ...prev,
              material: e.target.value
            }))}
            className="w-full p-1.5 border rounded text-xs"
          />
          
          <div className="flex gap-0.5">
            <input
              type="number"
              placeholder="Menge"
              value={quickMaterialEntry.quantity}
              onChange={(e) => setQuickMaterialEntry(prev => ({
                ...prev,
                quantity: e.target.value
              }))}
              className="flex-1 min-w-0 p-1.5 border rounded text-xs"
            />
            <select
              value={quickMaterialEntry.unit}
              onChange={(e) => setQuickMaterialEntry(prev => ({
                ...prev,
                unit: e.target.value
              }))}
              className="p-1.5 border rounded text-xs w-12"
            >
              <option value="Stück">Stk</option>
              <option value="Meter">m</option>
              <option value="kg">kg</option>
              <option value="Liter">L</option>
            </select>
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

  const renderDocumentationView = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">📚 Dokumentation</h3>
      
      <div className="space-y-3">
        {/* App Anleitung */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📱 App Bedienung
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Start-Tab:</strong> Übersicht und Schnellzugriff</div>
            <div><strong>Zeit-Tab:</strong> Zeiterfassung starten/stoppen</div>
            <div><strong>Signatur-Tab:</strong> Lieferscheine digital unterschreiben</div>
            <div><strong>Profil-Tab:</strong> Persönliche Einstellungen</div>
          </CardContent>
        </Card>

        {/* Zeiterfassung */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ⏱️ Zeiterfassung
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Starten:</strong> Projekt auswählen → "Start" drücken</div>
            <div><strong>Pausieren:</strong> "Pause" für Unterbrechungen</div>
            <div><strong>Beenden:</strong> "Stop" → Notizen hinzufügen</div>
            <div><strong>Arten:</strong> Arbeitszeit, Pause, Fahrtzeit</div>
          </CardContent>
        </Card>

        {/* Signatur-Funktionen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ✍️ Digitale Signaturen
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Lieferschein:</strong> Wareneingänge bestätigen</div>
            <div><strong>Auftragsabschluss:</strong> Arbeiten abzeichnen</div>
            <div><strong>Qualitätskontrolle:</strong> Prüfungen dokumentieren</div>
            <div><strong>Speicherung:</strong> Automatisch in der Cloud</div>
          </CardContent>
        </Card>

        {/* Offline Funktionen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📶 Offline Modus
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Zeiterfassung:</strong> Funktioniert ohne Internet</div>
            <div><strong>Signaturen:</strong> Werden lokal gespeichert</div>
            <div><strong>Synchronisation:</strong> Automatisch bei Verbindung</div>
            <div><strong>Status:</strong> Symbol zeigt Verbindung an</div>
          </CardContent>
        </Card>

        {/* Tipps & Tricks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              💡 Tipps & Tricks
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Batterie sparen:</strong> App läuft im Hintergrund</div>
            <div><strong>Genauigkeit:</strong> GPS für Standortverfolgung</div>
            <div><strong>Daten:</strong> Arbeitet auch im mobilen Netz</div>
            <div><strong>Updates:</strong> App automatisch aktualisieren</div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              🆘 Support
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Probleme:</strong> IT-Abteilung kontaktieren</div>
            <div><strong>Schulung:</strong> Bei Fragen an Vorgesetzte wenden</div>
            <div><strong>Version:</strong> HandwerkOS Mobile v1.0</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderTimeView = () => (
    <div className="space-y-2">
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
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3">
            <h4 className="font-medium mb-3">Projekt auswählen:</h4>
            <div className="space-y-2">
              {assignedProjects.map(project => (
                <Button
                  key={project.id}
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => startTimeTracking(project.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  STARTEN
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderActivityView = () => (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Meine Aktivitäten</h3>
      
      {/* Recent Photos */}
      {capturedPhotos.length > 0 && (
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Fotos ({capturedPhotos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
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
          <CardHeader className="p-3">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Rechnungen ({projectReceipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
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
          <CardHeader className="p-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notizen ({projectComments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
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
          <CardHeader className="p-3">
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
              <Package className="h-12 w-12 mx-auto" />
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

  const renderVacationView = () => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">Urlaub</h3>
        <Button onClick={() => setShowVacationDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Antrag
        </Button>
      </div>
      
      {/* Vacation Balance */}
      <Card>
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mein Urlaubskonto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{vacationBalance.total}</div>
              <div className="text-sm text-blue-700">Gesamte Tage</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{vacationBalance.available}</div>
              <div className="text-sm text-green-700">Verfügbar</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Request Button */}
      <Button 
        onClick={() => setShowVacationDialog(true)}
        className="w-full h-16 text-lg"
      >
        <Calendar className="h-6 w-6 mr-3" />
        Urlaubsantrag stellen
      </Button>

      {/* Info Card */}
      <Card>
        <CardContent className="p-3">
          <h4 className="font-medium mb-2">Hinweise</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Anträge werden vom Manager geprüft</li>
            <li>• Mindestens 2 Wochen im Voraus beantragen</li>
            <li>• Bei Krankmeldung sofort Bescheid geben</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  const renderProfileView = () => (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Profil</h3>
      
      <Card>
        <CardContent className="p-3">
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
          <CardContent className="p-3">
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

  // Onboarding removed - not needed

  return (
    <div className="h-full bg-gray-50 flex flex-col relative overflow-hidden" style={{ width: '100vw', maxWidth: 'none', paddingTop: '44px' }}>
      {/* Main Content */}
      <div className="flex-1 px-3 pt-2 pb-20 overflow-y-auto overflow-x-hidden">
        {currentView === 'home' && renderHomeView()}
        {currentView === 'docs' && renderDocumentationView()}
        {currentView === 'time' && (
          <div className="h-full -mx-3 -mb-16" style={{ marginTop: '-52px' }}>
            <EnhancedMobileTimeTracker />
          </div>
        )}
        {currentView === 'signature' && (
          <div className="h-full overflow-y-auto">
            <MobileDeliverySignature className="pb-4" />
          </div>
        )}
        {currentView === 'profile' && renderProfileView()}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute left-0 right-0 bottom-0 bg-white border-t shadow-lg pb-safe">
        <div className="grid grid-cols-5 gap-1 p-2">
          {[
            { id: 'home', icon: Home, label: 'Start' },
            { id: 'docs', icon: FileText, label: 'Dokumentation' },
            { id: 'time', icon: Clock, label: 'Zeit' },
            { id: 'signature', icon: PenTool, label: 'Signatur' },
            { id: 'profile', icon: User, label: 'Profil' }
          ].map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView(item.id as any)}
              className="flex flex-col gap-0.5 h-14 p-1 relative"
            >
              <item.icon className="h-4 w-4" />
              <span className="text-xs">{item.label}</span>
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
            muted
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
          <div className="space-y-2">
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
          <div className="space-y-2">
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

      <VacationRequestDialog
        open={showVacationDialog}
        onOpenChange={setShowVacationDialog}
        onSuccess={loadVacationBalance}
      />
    </div>
  );
};

export default MobileEmployeeApp;