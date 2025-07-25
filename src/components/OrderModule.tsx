
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Search, Calendar, User, Euro, AlertTriangle, CheckCircle, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AddOrderDialog from "./AddOrderDialog";
import EditOrderDialog from "./EditOrderDialog";

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
  };
}

const OrderModule = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      console.log('Fetching orders...');

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            company_name,
            contact_person
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        toast({
          title: "Fehler",
          description: "Aufträge konnten nicht geladen werden.",
          variant: "destructive"
        });
        return;
      }

      console.log('Orders fetched:', data);
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      console.log('Deleting order:', id);
      
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting order:', error);
        toast({
          title: "Fehler",
          description: "Auftrag konnte nicht gelöscht werden.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Auftrag wurde erfolgreich gelöscht."
      });

      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
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
      case 'Angebot': return <FileText className="h-4 w-4 text-blue-600" />;
      case 'Bestätigt': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'In Bearbeitung': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'Abgeschlossen': return <CheckCircle className="h-4 w-4 text-gray-600" />;
      case 'Storniert': return <X className="h-4 w-4 text-red-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatCurrency = (amount: number | null, currency: string | null = 'EUR') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customers?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Auftragsverwaltung
          </h2>
          <p className="text-gray-600">Verwalten Sie alle Aufträge und deren Status</p>
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Neuer Auftrag
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Aufträge durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredOrders.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Keine Aufträge gefunden' : 'Noch keine Aufträge'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? `Keine Aufträge gefunden für "${searchTerm}"`
                : 'Erstellen Sie Ihren ersten Auftrag'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ersten Auftrag erstellen
              </Button>
            )}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(order.status)}
                      <CardTitle className="text-lg">{order.order_number}</CardTitle>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                    <CardDescription className="font-medium text-gray-900">
                      {order.title}
                    </CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={getPriorityColor(order.priority)}>
                    {order.priority}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{order.customers?.company_name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Erstellt: {formatDate(order.order_date)}</span>
                  </div>

                  {order.due_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Fällig: {formatDate(order.due_date)}</span>
                    </div>
                  )}

                  {order.total_amount && (
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <Euro className="h-4 w-4" />
                      <span>{formatCurrency(order.total_amount, order.currency)}</span>
                    </div>
                  )}

                  {order.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {order.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteOrder(order.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Löschen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddOrderDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onOrderAdded={() => {
          fetchOrders();
          setIsAddDialogOpen(false);
        }}
      />

      {selectedOrder && (
        <EditOrderDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          order={selectedOrder}
          onOrderUpdated={() => {
            fetchOrders();
            setIsEditDialogOpen(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default OrderModule;
