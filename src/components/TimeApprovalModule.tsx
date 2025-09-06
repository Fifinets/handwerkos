import React from 'react'
import { TimeApprovalManager } from './manager/TimeApprovalManager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Clock } from 'lucide-react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const TimeApprovalModule: React.FC = () => {
  const { userRole } = useSupabaseAuth()
  
  // Nur Manager und Admins haben Zugriff
  if (userRole !== 'manager' && userRole !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Zugriff verweigert
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Sie benötigen Manager-Rechte, um auf die Zeitfreigabe zuzugreifen.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8 text-primary" />
            Zeitfreigabe
          </h1>
          <p className="text-muted-foreground mt-1">
            Prüfen und genehmigen Sie erfasste Arbeitszeiten mit automatischen Rundungsregeln
          </p>
        </div>
      </div>
      
      <TimeApprovalManager />
    </div>
  )
}

export default TimeApprovalModule