
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeConfirmationRequest {
  managerEmail: string;
  employeeName: string;
  employeeEmail: string;
  companyName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { managerEmail, employeeName, employeeEmail, companyName }: EmployeeConfirmationRequest = await req.json();

    console.log("Sending employee confirmation email to:", managerEmail);

    // Send email to manager
    const managerEmailResponse = await resend.emails.send({
      from: "ElektroManager Pro <onboarding@resend.dev>",
      to: [managerEmail],
      subject: `Neuer Mitarbeiter erfolgreich registriert - ${employeeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">✅ Mitarbeiter erfolgreich registriert</h1>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #374151; margin-top: 0;">Registrierungsdetails</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Name:</td>
                <td style="padding: 8px 0; color: #374151;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">E-Mail:</td>
                <td style="padding: 8px 0; color: #374151;">${employeeEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Registriert am:</td>
                <td style="padding: 8px 0; color: #374151;">${new Date().toLocaleString('de-DE')}</td>
              </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="margin: 0; color: #92400e;">
                <strong>Nächste Schritte:</strong><br>
                Der Mitarbeiter hat eine separate E-Mail mit Registrierungslink erhalten und kann sich nun registrieren.
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>Diese E-Mail wurde automatisch von Ihrem Personalverwaltungssystem gesendet.</p>
            ${companyName ? `<p>${companyName}</p>` : ''}
          </div>
        </div>
      `,
    });

    // Send registration email to employee
    const registrationUrl = `${Deno.env.get("SUPABASE_URL") || "https://qgwhkjrhndeoskrxewpb.supabase.co"}/auth/v1/verify?type=signup&token=placeholder&redirect_to=${encodeURIComponent("https://lovable.dev/auth?mode=employee-setup")}`;
    
    const employeeEmailResponse = await resend.emails.send({
      from: "ElektroManager Pro <onboarding@resend.dev>",
      to: [employeeEmail],
      subject: `Willkommen bei ElektroManager Pro - Registrierung abschließen`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🎉 Willkommen bei ElektroManager Pro!</h1>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #374151; margin-top: 0;">Hallo ${employeeName}!</h2>
            
            <p style="color: #374151; line-height: 1.6;">
              Sie wurden als Mitarbeiter bei <strong>${companyName || 'Ihrem Unternehmen'}</strong> registriert. 
              Um Ihr Konto zu aktivieren und Ihr Passwort zu erstellen, klicken Sie bitte auf den folgenden Link:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://lovable.dev/auth?mode=employee-setup" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Registrierung abschließen
              </a>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 4px;">
              <p style="margin: 0; color: #374151; font-size: 14px;">
                <strong>Was passiert als Nächstes?</strong><br>
                1. Klicken Sie auf den Registrierungslink<br>
                2. Erstellen Sie Ihr persönliches Passwort<br>
                3. Melden Sie sich in Ihrem Mitarbeiterkonto an
              </p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Wichtiger Hinweis:</strong><br>
                Falls der Link nicht funktioniert, kopieren Sie bitte die folgende URL in Ihren Browser:<br>
                <code style="background-color: #f9fafb; padding: 2px 4px; border-radius: 3px;">https://lovable.dev/auth?mode=employee-setup</code>
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>Diese E-Mail wurde automatisch von ElektroManager Pro gesendet.</p>
            <p>Bei Fragen wenden Sie sich bitte an Ihren Vorgesetzten.</p>
          </div>
        </div>
      `,
    });

    console.log("Manager email sent successfully:", managerEmailResponse);
    console.log("Employee email sent successfully:", employeeEmailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      managerMessageId: managerEmailResponse.data?.id,
      employeeMessageId: employeeEmailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-employee-confirmation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
