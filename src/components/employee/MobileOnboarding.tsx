import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Package, 
  Camera, 
  MapPin, 
  Wifi, 
  Bell,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Share,
  Home
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import usePushNotifications from "@/hooks/usePushNotifications";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: () => Promise<void>;
  actionText?: string;
}

interface MobileOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

const MobileOnboarding: React.FC<MobileOnboardingProps> = ({ onComplete, onSkip }) => {
  const { requestPermission, canReceiveNotifications, isSupported } = usePushNotifications();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isInstalling, setIsInstalling] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Installation handling
  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;
    
    setIsInstalling(true);
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setCompletedSteps(prev => new Set(prev).add('install'));
      }
      
      setDeferredPrompt(null);
    } finally {
      setIsInstalling(false);
    }
  };

  const enableNotifications = async () => {
    const success = await requestPermission();
    if (success) {
      setCompletedSteps(prev => new Set(prev).add('notifications'));
    }
  };

  const requestLocation = async () => {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      setCompletedSteps(prev => new Set(prev).add('location'));
    } catch (error) {
      console.warn('Location access denied');
      // Still mark as completed since it's optional
      setCompletedSteps(prev => new Set(prev).add('location'));
    }
  };

  const testCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      
      // Stop the stream immediately after testing
      stream.getTracks().forEach(track => track.stop());
      
      setCompletedSteps(prev => new Set(prev).add('camera'));
    } catch (error) {
      console.warn('Camera access denied');
      // Still mark as completed since it's optional
      setCompletedSteps(prev => new Set(prev).add('camera'));
    }
  };

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Willkommen bei HandwerkOS',
      description: 'Die mobile App für Handwerker. Erfassen Sie Zeit, Material und dokumentieren Sie Baufortschritte - auch offline.',
      icon: <Home className="h-8 w-8 text-blue-500" />
    },
    {
      id: 'install',
      title: 'App installieren',
      description: 'Installieren Sie die App auf Ihrem Gerät für schnelleren Zugriff und bessere Performance.',
      icon: <Download className="h-8 w-8 text-green-500" />,
      action: installPWA,
      actionText: 'Jetzt installieren'
    },
    {
      id: 'notifications',
      title: 'Benachrichtigungen aktivieren',
      description: 'Erhalten Sie wichtige Updates zu Projekten, Terminen und Erinnerungen zur Zeiterfassung.',
      icon: <Bell className="h-8 w-8 text-orange-500" />,
      action: enableNotifications,
      actionText: 'Erlauben'
    },
    {
      id: 'location',
      title: 'Standort freigeben',
      description: 'Ermöglicht automatische Standort-Zuordnung bei Zeiterfassung und Navigation zu Baustellen.',
      icon: <MapPin className="h-8 w-8 text-purple-500" />,
      action: requestLocation,
      actionText: 'Standort freigeben'
    },
    {
      id: 'camera',
      title: 'Kamera-Zugriff',
      description: 'Dokumentieren Sie Baufortschritte und Materialien durch Fotos direkt aus der App.',
      icon: <Camera className="h-8 w-8 text-red-500" />,
      action: testCamera,
      actionText: 'Kamera testen'
    },
    {
      id: 'features',
      title: 'Hauptfunktionen',
      description: 'Lernen Sie die wichtigsten Features kennen, die Ihnen den Arbeitsalltag erleichtern.',
      icon: <CheckCircle className="h-8 w-8 text-teal-500" />
    }
  ];

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isStepCompleted = completedSteps.has(currentStepData.id);

  const nextStep = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, onboardingSteps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const skipToEnd = () => {
    onSkip();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Progress Bar */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Setup</h2>
          <Button variant="ghost" size="sm" onClick={skipToEnd}>
            Überspringen
          </Button>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
          />
        </div>
        
        <div className="text-sm text-gray-600 mt-2">
          Schritt {currentStep + 1} von {onboardingSteps.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col justify-center">
        <Card className="max-w-sm mx-auto">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              {currentStepData.icon}
            </div>
            
            <h3 className="text-xl font-bold mb-4 text-gray-900">
              {currentStepData.title}
            </h3>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              {currentStepData.description}
            </p>

            {/* Step-specific content */}
            {currentStepData.id === 'features' && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-left bg-gray-50 p-3 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Zeiterfassung</p>
                    <p className="text-xs text-gray-600">Mit GPS und Offline-Support</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left bg-gray-50 p-3 rounded-lg">
                  <Package className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Materialerfassung</p>
                    <p className="text-xs text-gray-600">Schnelle Mengen- und Kostenerfassung</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left bg-gray-50 p-3 rounded-lg">
                  <Wifi className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">Offline-Fähig</p>
                    <p className="text-xs text-gray-600">Arbeiten auch ohne Internet</p>
                  </div>
                </div>
              </div>
            )}

            {/* Install PWA button */}
            {currentStepData.id === 'install' && (
              <div className="mb-6">
                {deferredPrompt ? (
                  <Button 
                    onClick={currentStepData.action}
                    className="w-full"
                    disabled={isInstalling}
                  >
                    {isInstalling ? 'Installiere...' : currentStepData.actionText}
                  </Button>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      App bereits installiert oder Installation nicht verfügbar
                    </p>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Bereit
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Permissions buttons */}
            {currentStepData.action && currentStepData.id !== 'install' && (
              <div className="mb-6">
                {isStepCompleted ? (
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aktiviert
                  </Badge>
                ) : (
                  <Button 
                    onClick={currentStepData.action}
                    className="w-full"
                  >
                    {currentStepData.actionText}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Preview Cards (for welcome step) */}
        {currentStepData.id === 'welcome' && (
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mt-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-blue-700">Zeit erfassen</p>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-green-700">Material buchen</p>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4 text-center">
                <Camera className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-purple-700">Fotos machen</p>
              </CardContent>
            </Card>
            
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4 text-center">
                <Wifi className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                <p className="text-xs font-medium text-orange-700">Offline arbeiten</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="bg-white border-t p-4 flex justify-between items-center">
        <Button 
          variant="outline" 
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        
        <div className="flex gap-1">
          {onboardingSteps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        
        <Button 
          onClick={nextStep}
          className="flex items-center gap-2"
        >
          {isLastStep ? 'Fertig' : 'Weiter'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MobileOnboarding;