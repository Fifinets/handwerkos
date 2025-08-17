import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const EmailConfirmed: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.log('No session after email confirmation');
          navigate('/auth');
          return;
        }

        console.log('Email confirmed for user:', session.user.email);

        // Update employee status to 'Aktiv' now that email is confirmed
        const { data: employee, error: fetchError } = await supabase
          .from('employees')
          .select('id, status')
          .eq('email', session.user.email?.toLowerCase())
          .single();

        if (employee && employee.status === 'eingeladen') {
          const { error: updateError } = await supabase
            .from('employees')
            .update({ 
              status: 'Aktiv',
              user_id: session.user.id 
            })
            .eq('id', employee.id);

          if (!updateError) {
            console.log('Employee status updated to Aktiv after email confirmation');
            toast.success('E-Mail bestätigt! Ihr Account ist jetzt aktiv.');
          }
        }

        // Redirect to manager page after 2 seconds
        setTimeout(() => {
          navigate('/manager');
        }, 2000);

      } catch (error) {
        console.error('Error handling email confirmation:', error);
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };

    handleEmailConfirmation();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">E-Mail bestätigt!</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {loading ? (
            <p className="text-gray-600">Account wird aktiviert...</p>
          ) : (
            <p className="text-gray-600">Sie werden automatisch weitergeleitet...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmed;