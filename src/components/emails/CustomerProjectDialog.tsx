import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { User, Building, MapPin, Calendar, DollarSign, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Email {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  content: string;
  ai_extracted_data?: any;
}

interface CustomerProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  email: Email;
}

interface Customer {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
}

export function CustomerProjectDialog({ isOpen, onClose, email }: CustomerProjectDialogProps) {
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [customerData, setCustomerData] = useState({
    company_name: "",
    contact_person: email.sender_name || "",
    email: email.sender_email,
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    country: "Deutschland"
  });
  
  const [projectData, setProjectData] = useState({
    name: email.subject || "",
    location: "",
    gross_revenue: "",
    start_date: "",
    end_date: "",
    description: ""
  });

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      checkExistingCustomer();
      extractDataFromEmail();
    }
  }, [isOpen, email]);

  const checkExistingCustomer = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email.sender_email)
      .maybeSingle();

    if (!error && data) {
      setExistingCustomer(data);
      setCustomerData({
        company_name: data.company_name,
        contact_person: data.contact_person,
        email: data.email,
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        postal_code: data.postal_code || "",
        country: data.country || "Deutschland"
      });
    }
  };

  const extractDataFromEmail = () => {
    if (email.ai_extracted_data) {
      const extractedData = email.ai_extracted_data;
      
      // Update customer data from AI extraction
      if (extractedData.customerInfo) {
        setCustomerData(prev => ({
          ...prev,
          company_name: extractedData.customerInfo.company || prev.company_name,
          contact_person: extractedData.customerInfo.name || prev.contact_person,
          phone: extractedData.customerInfo.phone || prev.phone
        }));
      }

      // Update project data from AI extraction
      if (extractedData.orderInfo) {
        setProjectData(prev => ({
          ...prev,
          gross_revenue: extractedData.orderInfo.amount ? extractedData.orderInfo.amount.toString() : "",
          end_date: extractedData.orderInfo.deadline || ""
        }));
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      let customerId = existingCustomer?.id;

      // Get current user's company ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .single();

      if (!profileData?.company_id) {
        throw new Error('Firma nicht gefunden');
      }

      // Create or update customer
      if (!existingCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            ...customerData,
            company_id: profileData.company_id
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      } else {
        const { error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', existingCustomer.id);

        if (updateError) throw updateError;
      }

      // Create project
      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          location: projectData.location,
          start_date: projectData.start_date || new Date().toISOString().split('T')[0],
          end_date: projectData.end_date || null,
          customer_id: customerId,
          company_id: profileData.company_id,
          status: 'geplant'
        });

      if (projectError) throw projectError;

      // Update email with customer ID
      const { error: emailError } = await supabase
        .from('emails')
        .update({ customer_id: customerId })
        .eq('id', email.id);

      if (emailError) throw emailError;

      toast({
        title: "Erfolgreich gespeichert",
        description: `Kunde ${existingCustomer ? 'aktualisiert' : 'erstellt'} und Projekt angelegt.`,
      });

      onClose();
    } catch (error: any) {
      console.error('Error saving data:', error);
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Speichern der Daten.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Kundenanfrage annehmen
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Kundeninformationen
                {existingCustomer && (
                  <span className="text-sm text-green-600 font-normal">
                    (Bestehender Kunde)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company_name">Firmenname *</Label>
                  <Input
                    id="company_name"
                    value={customerData.company_name}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Musterfirma GmbH"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Ansprechpartner *</Label>
                  <Input
                    id="contact_person"
                    value={customerData.contact_person}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Max Mustermann"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-Mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="info@musterfirma.de"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+49 123 456789"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={customerData.address}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Musterstraße 123"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="postal_code">PLZ</Label>
                  <Input
                    id="postal_code"
                    value={customerData.postal_code}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, postal_code: e.target.value }))}
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Stadt</Label>
                  <Input
                    id="city"
                    value={customerData.city}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Musterstadt"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Land</Label>
                  <Select 
                    value={customerData.country} 
                    onValueChange={(value) => setCustomerData(prev => ({ ...prev, country: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Deutschland">Deutschland</SelectItem>
                      <SelectItem value="Österreich">Österreich</SelectItem>
                      <SelectItem value="Schweiz">Schweiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5" />
                Projektinformationen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="project_name">Projektname *</Label>
                <Input
                  id="project_name"
                  value={projectData.name}
                  onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Renovierung Bürogebäude"
                />
              </div>

              <div>
                <Label htmlFor="location">Standort</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={projectData.location}
                    onChange={(e) => setProjectData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Projektadresse"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gross_revenue">Bruttoumsatz (€)</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="gross_revenue"
                    type="number"
                    value={projectData.gross_revenue}
                    onChange={(e) => setProjectData(prev => ({ ...prev, gross_revenue: e.target.value }))}
                    placeholder="50000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Projektstart</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="start_date"
                      type="date"
                      value={projectData.start_date}
                      onChange={(e) => setProjectData(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="end_date">Projektende</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="end_date"
                      type="date"
                      value={projectData.end_date}
                      onChange={(e) => setProjectData(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Projektbeschreibung</Label>
                <Textarea
                  id="description"
                  value={projectData.description}
                  onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detaillierte Beschreibung des Projekts..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Speichere..." : "Projekt anlegen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}