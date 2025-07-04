import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Euro, Plus, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import AddTransactionDialog from './AddTransactionDialog';

const FinanceModule = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState([
    {
      id: "T001",
      type: "Einnahme",
      amount: 15000,
      category: "Projekteinnahme",
      description: "Zahlung Büroerweiterung Müller GmbH",
      date: "15.03.2024",
      project: "Büroerweiterung Müller GmbH",
      status: "Bestätigt"
    },
    {
      id: "T002",
      type: "Ausgabe",
      amount: 5000,
      category: "Material",
      description: "Betonlieferung für Lagerhalle Wagner KG",
      date: "20.03.2024",
      project: "Lagerhalle Wagner KG",
      status: "Bestätigt"
    },
    {
      id: "T003",
      type: "Ausgabe",
      amount: 2500,
      category: "Personal",
      description: "Gehaltszahlung März 2024",
      date: "31.03.2024",
      project: "Alle",
      status: "Bestätigt"
    },
    {
      id: "T004",
      type: "Einnahme",
      amount: 8000,
      category: "Projekteinnahme",
      description: "Abschlagszahlung für Dacharbeiten",
      date: "05.04.2024",
      project: "Neubau Wohnanlage Sonnenblick",
      status: "Bestätigt"
    }
  ]);

  const handleAddTransaction = (newTransaction: any) => {
    setTransactions(prev => [...prev, newTransaction]);
  };

  const getTypeIcon = (type: string) => {
    return type === 'Einnahme' ? 
      <TrendingUp className="h-4 w-4 text-green-600" /> : 
      <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getTypeColor = (type: string) => {
    return type === 'Einnahme' ? 
      'bg-green-100 text-green-800' : 
      'bg-red-100 text-red-800';
  };

  // Berechnung der Gesamtsummen
  const totalIncome = transactions
    .filter(t => t.type === 'Einnahme')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'Ausgabe')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Finanzen</h2>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neue Transaktion
        </Button>
      </div>

      {/* Finanzübersicht */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamteinnahmen</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{totalIncome.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtausgaben</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">€{totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Euro className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaktionsliste */}
      <div className="grid gap-4">
        {transactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(transaction.type)}
                  <CardTitle className="text-lg">{transaction.description}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getTypeColor(transaction.type)}>
                    {transaction.type}
                  </Badge>
                  <span className={`text-lg font-bold ${transaction.type === 'Einnahme' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.type === 'Einnahme' ? '+' : '-'}€{transaction.amount.toLocaleString()}
                  </span>
                </div>
              </div>
              <CardDescription>{transaction.category}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  {transaction.date}
                </div>
                <div>Projekt: {transaction.project}</div>
                <Badge variant="outline">{transaction.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddTransactionDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onTransactionAdded={handleAddTransaction}
      />
    </div>
  );
};

export default FinanceModule;
