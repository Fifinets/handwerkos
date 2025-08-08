import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Building2,
  MapPin,
  Phone,
  Mail,
  Edit,
  Plus,
  User,
  Euro,
  Package,
  Truck,
  MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  title: string;
  description: string | null;
  order_date: string;
  due_date: string | null;
  status: string;
  priority: string;
  total_amount: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    company_name: string;
    contact_person: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}

interface OrderDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

const OrderDetailView: React.FC<OrderDetailViewProps> = ({ isOpen, onClose, orderId }) => {
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderData();
    }
  }, [isOpen, orderId]);

  const fetchOrderData = async () => {
    setLoading(true);
    try {
      const { data: orderData, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email,
            phone,
            address
          )
        `)
        .eq('id', orderId)
        .single();

      if (error || !orderData) {
        toast({
          title: "Fehler",
          description: "Auftrag nicht gefunden",
          variant: "destructive"
        });
        return;
      }

      setOrder(orderData);
    } catch (error) {
      console.error('Error fetching order data:', error);
      toast({
        title: "Fehler",
        description: "Auftragsdaten konnten nicht geladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;

      setOrder(prev => prev ? { ...prev, status: newStatus } : null);
      toast({
        title: "Erfolg",
        description: "Auftragsstatus wurde aktualisiert"
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null = 'EUR') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Angebot': return 'bg-blue-100 text-blue-800';
      case 'Bestätigt': return 'bg-green-100 text-green-800';
      case 'In Bearbeitung': return 'bg-yellow-100 text-yellow-800';
      case 'Abgeschlossen': return 'bg-gray-100 text-gray-800';
      case 'Storniert': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Niedrig': return 'bg-green-100 text-green-800';
      case 'Normal': return 'bg-blue-100 text-blue-800';
      case 'Hoch': return 'bg-orange-100 text-orange-800';
      case 'Dringend': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Angebot': return <FileText className="h-5 w-5 text-blue-600" />;
      case 'Bestätigt': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'In Bearbeitung': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'Abgeschlossen': return <CheckCircle className="h-5 w-5 text-gray-600" />;
      case 'Storniert': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getNextStatuses = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'Angebot':
        return ['Bestätigt', 'Storniert'];
      case 'Bestätigt':
        return ['In Bearbeitung'];
      case 'In Bearbeitung':
        return ['Abgeschlossen', 'Storniert'];
      case 'Abgeschlossen':
        return [];
      case 'Storniert':
        return ['Angebot'];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Auftragsdaten werden geladen...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!order) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Auftrag nicht gefunden</h3>
            <p className="text-gray-600">Der angeforderte Auftrag konnte nicht geladen werden.</p>
            <Button onClick={onClose} className="mt-4">
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const nextStatuses = getNextStatuses(order.status);
  const isOverdue = order.due_date && new Date(order.due_date) < new Date() && order.status !== 'Abgeschlossen';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6" />
                {order.order_number}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-4 mt-2">
                <Badge className={getStatusColor(order.status)}>
                  {getStatusIcon(order.status)} {order.status}
                </Badge>
                <Badge className={getPriorityColor(order.priority)}>
                  {order.priority}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Überfällig
                  </Badge>
                )}
                <span className="text-gray-500">ID: {order.id}</span>
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Schließen
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="items">Positionen</TabsTrigger>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
            <TabsTrigger value="history">Verlauf</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Order Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Auftragswert</p>
                      <p className="text-2xl font-bold">{formatCurrency(order.total_amount, order.currency)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="text-lg font-bold">{order.status}</p>
                    </div>
                    {getStatusIcon(order.status)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Priorität</p>
                      <p className="text-lg font-bold">{order.priority}</p>
                    </div>
                    <AlertTriangle className={`h-8 w-8 ${
                      order.priority === 'Dringend' ? 'text-red-500' : 
                      order.priority === 'Hoch' ? 'text-orange-500' : 
                      'text-blue-500'
                    }`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Erstellt</p>
                      <p className="text-lg font-bold">{formatDate(order.order_date)}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Order Details */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Auftragsdetails</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Titel</p>
                      <p className="font-medium text-lg">{order.title}</p>
                    </div>
                    
                    {order.description && (
                      <div>
                        <p className="text-sm text-gray-600">Beschreibung</p>
                        <p className="font-medium">{order.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Auftragsdatum</p>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(order.order_date)}
                        </p>
                      </div>
                      {order.due_date && (
                        <div>
                          <p className="text-sm text-gray-600">Fälligkeitsdatum</p>
                          <p className={`font-medium flex items-center gap-2 ${isOverdue ? 'text-red-600' : ''}`}>
                            <Calendar className="h-4 w-4" />
                            {formatDate(order.due_date)}
                            {isOverdue && <AlertTriangle className="h-4 w-4" />}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-600">Erstellt am</p>
                        <p className="font-medium">{formatDateTime(order.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Letzte Änderung</p>
                        <p className="font-medium">{formatDateTime(order.updated_at)}</p>
                      </div>
                    </div>

                    {order.notes && (
                      <div>
                        <p className="text-sm text-gray-600">Notizen</p>
                        <p className="font-medium bg-gray-50 p-3 rounded-lg">{order.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Information */}
                {order.customers && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Kundeninformationen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Unternehmen</p>
                        <p className="font-medium">{order.customers.company_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Ansprechpartner</p>
                        <p className="font-medium">{order.customers.contact_person}</p>
                      </div>
                      <div className="flex gap-4">
                        {order.customers.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{order.customers.email}</span>
                          </div>
                        )}
                        {order.customers.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{order.customers.phone}</span>
                          </div>
                        )}
                      </div>
                      {order.customers.address && (
                        <div>
                          <p className="text-sm text-gray-600">Adresse</p>
                          <p className="font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {order.customers.address}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Status Management */}
                {nextStatuses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Status ändern</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {nextStatuses.map(nextStatus => (
                        <Button
                          key={nextStatus}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleStatusChange(nextStatus)}
                        >
                          {getStatusIcon(nextStatus)} {nextStatus}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Aktionen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Package className="h-4 w-4 mr-2" />
                      Lieferschein erstellen
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Rechnung erstellen
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Truck className="h-4 w-4 mr-2" />
                      Lieferstatus prüfen
                    </Button>
                  </CardContent>
                </Card>

                {/* Order Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle>Verlauf</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="border-l-2 border-blue-200 pl-3">
                      <p className="text-sm font-medium">Auftrag erstellt</p>
                      <p className="text-xs text-gray-600">System</p>
                      <span className="text-xs text-gray-500">{formatDateTime(order.created_at)}</span>
                    </div>
                    {order.updated_at !== order.created_at && (
                      <div className="border-l-2 border-green-200 pl-3">
                        <p className="text-sm font-medium">Auftrag aktualisiert</p>
                        <p className="text-xs text-gray-600">System</p>
                        <span className="text-xs text-gray-500">{formatDateTime(order.updated_at)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Auftragspositionen</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Position hinzufügen
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Auftragspositionen werden hier angezeigt...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Dokumente</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Dokument hochladen
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Auftragsdokumente werden hier angezeigt...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Auftragsverlauf</h3>
              <Button>
                <MessageSquare className="h-4 w-4 mr-2" />
                Kommentar hinzufügen
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <p className="text-sm font-medium">Auftrag erstellt</p>
                    <p className="text-xs text-gray-600">Auftrag wurde automatisch vom System erstellt</p>
                    <span className="text-xs text-gray-500">{formatDateTime(order.created_at)}</span>
                  </div>
                  {order.updated_at !== order.created_at && (
                    <div className="border-l-4 border-green-500 pl-4">
                      <p className="text-sm font-medium">Auftrag aktualisiert</p>
                      <p className="text-xs text-gray-600">Auftragsinformationen wurden geändert</p>
                      <span className="text-xs text-gray-500">{formatDateTime(order.updated_at)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailView;