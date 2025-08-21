import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Eye,
  FileIcon,
  Calendar,
  User,
  Shield,
  Briefcase,
  Heart,
  GraduationCap,
  FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmployeeFile {
  id: string;
  name: string;
  category: string;
  size: number;
  uploadDate: string;
  expiryDate?: string;
  type: string;
  url?: string;
}

interface EmployeeFilesProps {
  employeeId: string;
}

const FILE_CATEGORIES = [
  { value: 'contract', label: 'Arbeitsvertrag', icon: Briefcase },
  { value: 'certificate', label: 'Zeugnis', icon: GraduationCap },
  { value: 'qualification', label: 'Qualifikation', icon: Shield },
  { value: 'medical', label: 'Gesundheit', icon: Heart },
  { value: 'personal', label: 'Persönliche Dokumente', icon: User },
  { value: 'training', label: 'Schulungen', icon: FileCheck },
  { value: 'other', label: 'Sonstiges', icon: FileIcon }
];

export default function EmployeeFiles({ employeeId }: EmployeeFilesProps) {
  const [files, setFiles] = useState<EmployeeFile[]>([
    {
      id: '1',
      name: 'Arbeitsvertrag_2024.pdf',
      category: 'contract',
      size: 245000,
      uploadDate: '2024-01-15',
      type: 'application/pdf'
    },
    {
      id: '2',
      name: 'Führerschein_B.pdf',
      category: 'qualification',
      size: 180000,
      uploadDate: '2024-01-20',
      expiryDate: '2028-05-15',
      type: 'application/pdf'
    },
    {
      id: '3',
      name: 'Erste_Hilfe_Zertifikat.pdf',
      category: 'training',
      size: 95000,
      uploadDate: '2024-02-10',
      expiryDate: '2026-02-10',
      type: 'application/pdf'
    }
  ]);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<EmployeeFile | null>(null);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    Array.from(uploadedFiles).forEach((file) => {
      const newFile: EmployeeFile = {
        id: Date.now().toString() + Math.random().toString(),
        name: file.name,
        category: uploadCategory,
        size: file.size,
        uploadDate: new Date().toISOString().split('T')[0],
        expiryDate: uploadExpiryDate || undefined,
        type: file.type
      };
      
      setFiles([...files, newFile]);
    });

    toast({
      title: 'Datei hochgeladen',
      description: `${uploadedFiles.length} Datei(en) wurden erfolgreich hochgeladen.`
    });
    
    setShowUploadDialog(false);
    setUploadCategory('other');
    setUploadExpiryDate('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = () => {
    if (!selectedFile) return;
    
    setFiles(files.filter(f => f.id !== selectedFile.id));
    toast({
      title: 'Datei gelöscht',
      description: `${selectedFile.name} wurde erfolgreich gelöscht.`
    });
    setShowDeleteDialog(false);
    setSelectedFile(null);
  };

  const handleDownloadFile = (file: EmployeeFile) => {
    toast({
      title: 'Download gestartet',
      description: `${file.name} wird heruntergeladen...`
    });
  };

  const handleViewFile = (file: EmployeeFile) => {
    toast({
      title: 'Datei öffnen',
      description: `${file.name} wird in einem neuen Tab geöffnet...`
    });
  };

  const getCategoryIcon = (category: string) => {
    const cat = FILE_CATEGORIES.find(c => c.value === category);
    return cat ? cat.icon : FileIcon;
  };

  const getCategoryLabel = (category: string) => {
    const cat = FILE_CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : 'Sonstiges';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'contract': return 'bg-blue-100 text-blue-800';
      case 'certificate': return 'bg-green-100 text-green-800';
      case 'qualification': return 'bg-purple-100 text-purple-800';
      case 'medical': return 'bg-red-100 text-red-800';
      case 'personal': return 'bg-yellow-100 text-yellow-800';
      case 'training': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const groupedFiles = files.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = [];
    }
    acc[file.category].push(file);
    return acc;
  }, {} as Record<string, EmployeeFile[]>);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Dateien & Dokumente</CardTitle>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Datei hochladen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <FileIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Keine Dateien vorhanden</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowUploadDialog(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Erste Datei hochladen
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedFiles).map(([category, categoryFiles]) => {
                const CategoryIcon = getCategoryIcon(category);
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <CategoryIcon className="h-4 w-4 text-gray-500" />
                      <h4 className="font-medium text-sm">{getCategoryLabel(category)}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {categoryFiles.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {categoryFiles.map((file) => (
                        <div 
                          key={file.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>{formatFileSize(file.size)}</span>
                                <span>•</span>
                                <span>Hochgeladen am {formatDate(file.uploadDate)}</span>
                                {file.expiryDate && (
                                  <>
                                    <span>•</span>
                                    <span className={
                                      isExpired(file.expiryDate) 
                                        ? 'text-red-600 font-medium' 
                                        : isExpiringSoon(file.expiryDate)
                                        ? 'text-yellow-600 font-medium'
                                        : ''
                                    }>
                                      {isExpired(file.expiryDate) 
                                        ? 'Abgelaufen' 
                                        : `Gültig bis ${formatDate(file.expiryDate)}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewFile(file)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedFile(file);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datei hochladen</DialogTitle>
            <DialogDescription>
              Laden Sie Dokumente für diesen Mitarbeiter hoch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Kategorie</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILE_CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    return (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {category.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Ablaufdatum (optional)
              </label>
              <Input
                type="date"
                value={uploadExpiryDate}
                onChange={(e) => setUploadExpiryDate(e.target.value)}
                placeholder="z.B. für Zertifikate oder Führerscheine"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Datei auswählen</label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <p className="text-xs text-gray-500 mt-1">
                PDF, Word, oder Bilddateien (max. 10MB pro Datei)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Datei löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Datei "{selectedFile?.name}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}