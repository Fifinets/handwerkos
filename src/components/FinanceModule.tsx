
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calculator, 
  Euro, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Plus,
  Receipt,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Download,
  Edit2,
  Save,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FinancialStats, MonthlyRevenue, Invoice, Expense } from "@/types/financial";
import { SupplierInvoiceList } from "./SupplierInvoiceList";
import { 
  useInvoices, 
  useFinancialKpis,
  useExpenses,
  useCreateInvoice
} from "@/hooks/useApi";
import { supabase } from "@/integrations/supabase/client";

// Simplified interface for mock/display data that may not have all required Invoice fields
interface InvoiceDisplay {
  id: string | number;
  invoice_number: string;
  title: string;
  total_amount: number;
  status: string;
  invoice_date: string;
  due_date: string;
  customers?: {
    company_name: string;
    contact_person: string;
  };
}

const FinanceModule = () => {
  const { toast } = useToast();
  
  // React Query hooks
  const { data: invoicesResponse, isLoading: invoicesLoading } = useInvoices();
  const { data: expensesResponse, isLoading: expensesLoading } = useExpenses();
  const { data: financialKPIs, isLoading: kpisLoading } = useFinancialKpis();
  // Employee data state - fetch manually since useEmployees hook doesn't exist
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [companyWorkingHours, setCompanyWorkingHours] = useState({
    hoursPerDay: 0,  // Will be loaded from database
    breakHours: 0,  // Will be loaded from database
    loaded: false
  });
  
  const createInvoiceMutation = useCreateInvoice();
  
  // Local state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategories, setEditingCategories] = useState<{[key: string]: typeof savedCategories[0]}>({});
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '💼',
    items: [{name: '', value: '0'}]
  });
  const [savedCategories, setSavedCategories] = useState<Array<{
    id: string;
    name: string;
    icon: string;
    items: Array<{name: string; value: string}>;
    total: number;
  }>>([]);

  // Load saved categories from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('handwerkos_custom_categories');
    if (saved) {
      try {
        setSavedCategories(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved categories:', error);
      }
    }
  }, []);

  // Save categories to localStorage whenever they change
  useEffect(() => {
    if (savedCategories.length > 0) {
      localStorage.setItem('handwerkos_custom_categories', JSON.stringify(savedCategories));
    }
  }, [savedCategories]);

  // Debug useEffect for working hours
  useEffect(() => {
    console.log('🔄 Working hours state updated:', companyWorkingHours);
  }, [companyWorkingHours]);

  const [editValues, setEditValues] = useState({
    miete: '1.000',
    nebenkosten: '300',
    reinigung: '100',
    fahrzeugLeasing: '500',
    fahrzeugVersicherung: '150',
    fahrzeugSteuer: '100',
    versicherungHaftpflicht: '200',
    versicherungRente: '300',
    versicherungBerufsunfaehigkeit: '150',
    verwaltungSoftware: '150',
    verwaltungSteuerberater: '250',
    verwaltungMarketing: '200',
    personalGehaelter: '708',
    personalSozialversicherung: '142',
    personalWeihnachtsgeld: '100'
  });

  // Calculate total from base costs + saved categories
  const calculateTotalCosts = () => {
    const personnelCosts = calculatePersonnelCosts();
    const baseCosts = 1400 + personnelCosts.total + 750 + 392 + 600; // Base categories with dynamic personnel (monthly)
    const savedCategoriesTotal = savedCategories.reduce((sum, category) => sum + category.total, 0);
    return baseCosts + savedCategoriesTotal;
  };

  // Helper to calculate category total from items
  const calculateCategoryTotal = (items: Array<{name: string; value: string}>) => {
    return items.reduce((sum, item) => {
      const value = parseFloat(item.value.replace(/[^\d.-]/g, '')) || 0;
      return sum + value;
    }, 0);
  };

  // Calculate personnel costs from real employee data
  const calculatePersonnelCosts = () => {
    console.log('FinanceModule calculatePersonnelCosts:', {
      employees,
      employeeCount: employees?.length || 0,
      employeesLoading
    });
    
    if (!employees || employees.length === 0) {
      console.log('FinanceModule: No employees found, returning zero costs');
      return {
        totalSalaries: 0,
        socialInsurance: 0,
        bonuses: 0,
        total: 0,
        employeeCount: 0
      };
    }

    // Get wages from localStorage (where EmployeeWageManagementSimple stores them)
    const savedWages = localStorage.getItem('employeeWages');
    const wagesData: Array<{employee_id: string; hourly_wage: number}> = savedWages ? JSON.parse(savedWages) : [];
    
    console.log('💾 Loaded wages from localStorage:', wagesData);

    // Filter active employees - check multiple status variations
    const activeEmployees = employees.filter(emp => {
      const status = emp.status?.toLowerCase();
      return status === 'active' || status === 'aktiv' || !emp.status; // Include employees without status
    });
    
    const employeeCount = activeEmployees.length;
    
    // Calculate total monthly salaries from real employee data
    const totalMonthlySalaries = activeEmployees.reduce((total, employee) => {
      // Calculate monthly salary from hourly rate
      // Accurate calculation: 21.25 working days/month × company hours/day
      // This accounts for weekends and holidays
      const workingDaysPerMonth = 21.25;
      const hoursPerMonth = workingDaysPerMonth * companyWorkingHours.hoursPerDay;
      
      // First try to get wage from localStorage, then fall back to database value
      const wageEntry = wagesData.find(w => w.employee_id === employee.id);
      const hourlyRate = wageEntry?.hourly_wage || employee.hourly_rate || 0;
      
      const monthlySalary = hourlyRate * hoursPerMonth;
      
      console.log(`👷 Employee ${employee.first_name} ${employee.last_name}:`, {
        status: employee.status,
        hourly_rate_from_db: employee.hourly_rate,
        hourly_rate_from_localStorage: wageEntry?.hourly_wage,
        hourly_rate_used: hourlyRate,
        hours_per_month: hoursPerMonth,
        calculated_monthly: monthlySalary.toFixed(2) + '€'
      });
      
      // Warn if no hourly rate is set
      if (!employee.hourly_rate || employee.hourly_rate === 0) {
        console.warn(`⚠️ Employee ${employee.first_name} ${employee.last_name} has no hourly rate set!`);
      }
      
      return total + monthlySalary;
    }, 0);
    
    console.log('💰 Total monthly salaries calculation:', {
      activeEmployeeCount: employeeCount,
      totalMonthlySalaries: totalMonthlySalaries.toFixed(2) + '€'
    });
    
    // German social insurance rates (realistic employer contributions)
    // Krankenversicherung: ~7.3%, Rentenversicherung: ~9.3%, 
    // Arbeitslosenversicherung: ~1.2%, Pflegeversicherung: ~1.7%
    // Total: ~19.5% + potential additions
    const socialInsuranceRate = 0.21; // 21% employer contribution (realistic)
    const monthlySocialInsurance = totalMonthlySalaries * socialInsuranceRate;
    
    // Annual bonus calculation (13. Monatsgehalt + Urlaubsgeld)
    // Many companies pay 13th month salary + vacation bonus
    const annualBonus = totalMonthlySalaries * 2; // 2 months as bonus (13. Gehalt + Urlaubsgeld)
    const monthlyBonus = annualBonus / 12;
    
    const result = {
      totalSalaries: totalMonthlySalaries,
      socialInsurance: monthlySocialInsurance,
      bonuses: monthlyBonus,
      total: totalMonthlySalaries + monthlySocialInsurance + monthlyBonus,
      employeeCount
    };
    
    console.log('Personnel costs calculation result:', result);
    
    return result;
  };

  // Calculate hourly rates dynamically (based on monthly costs)
  const calculateHourlyRates = () => {
    const monthlyFixedCosts = calculateTotalCosts() / 12; // Convert to monthly
    const monthlyVariableCosts = 8000 / 12; // Monthly variable costs
    const monthlyDesiredProfit = 25000 / 12; // Monthly profit target
    const monthlyTotalAmount = monthlyFixedCosts + monthlyVariableCosts + monthlyDesiredProfit;
    
    // Accurate working hours: 21.25 days × productive hours (breaks are unpaid)
    const workingDaysPerMonth = 21.25;
    const productiveHoursPerDay = companyWorkingHours.hoursPerDay - companyWorkingHours.breakHours;
    const workingHoursPerMonth = workingDaysPerMonth * productiveHoursPerDay; // Use productive hours (paid hours only)
    
    const minimumRate = monthlyTotalAmount / workingHoursPerMonth;
    const recommendedRate = minimumRate * 1.3; // 30% buffer as shown
    
    return { 
      minimumRate, 
      recommendedRate, 
      totalAmount: monthlyTotalAmount, 
      workingHours: workingHoursPerMonth 
    };
  };
  
  // Extract data from responses
  const invoices = invoicesResponse?.items || [];
  const expenses = expensesResponse?.items || [];
  const stats = financialKPIs || {
    monthly_revenue: 0,
    monthly_expenses: 0,
    monthly_profit: 0,
    total_outstanding: 0,
    overdue_count: 0,
    active_projects_profit: 0,
    avg_profit_margin: 0,
    revenue_trend: 0,
    expense_trend: 0,
    profit_trend: 0
  };
  
  // Loading state
  const loading = invoicesLoading || expensesLoading || kpisLoading || employeesLoading;

  // Fetch company working hours
  const fetchCompanyWorkingHours = async () => {
    try {
      console.log('⏰ Starting to fetch company working hours...', new Date().toISOString());
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        console.log('❌ No authenticated user');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.user.id)
        .single();

      console.log('👤 Profile query result:', { profile, profileError });

      if (!profile?.company_id) {
        console.log('❌ No company_id found in profile');
        return;
      }

      console.log('🔍 Fetching settings for company_id:', profile.company_id);
      
      const { data: settings, error } = await supabase
        .from('company_settings')
        .select('default_working_hours_start, default_working_hours_end, default_break_duration, company_id')
        .eq('company_id', profile.company_id)
        .single();
        
      console.log('📊 Query result:', { settings, error });

      if (error || !settings) {
        console.log('⚠️ No company settings found, checking if we need to create them');
        
        // Try to create default settings for this company
        const { data: newSettings, error: createError } = await supabase
          .from('company_settings')
          .insert({
            company_id: profile.company_id,
            company_name: 'Meine Firma',
            default_working_hours_start: '08:00:00',
            default_working_hours_end: '17:00:00',
            default_break_duration: 30,
            default_tax_rate: 19.00,
            default_currency: 'EUR',
            quote_validity_days: 30,
            invoice_prefix: 'R',
            quote_prefix: 'Q',
            order_prefix: 'A'
          })
          .select()
          .single();
          
        if (createError) {
          console.log('⚠️ Could not create settings, using default values. Error:', createError);
          // Use sensible defaults if no settings found
          setCompanyWorkingHours({
            hoursPerDay: 8,  // 8:00-16:00 as shown in UI
            breakHours: 0.5, // 30 minutes standard break
            loaded: true
          });
          return;
        }
        
        console.log('✅ Created default company settings:', newSettings);
        // Use the newly created settings
        setCompanyWorkingHours({
          hoursPerDay: 9,  // 8:00-17:00 = 9 hours
          breakHours: 0.5, // 30 minutes standard break
          loaded: true
        });
        return;
      }

      console.log('📋 Raw company settings:', settings);

      // Calculate hours per day - handle both HH:MM and HH:MM:SS formats
      const startTimeRaw = settings.default_working_hours_start || '08:00';
      const endTimeRaw = settings.default_working_hours_end || '17:00';
      
      // Remove seconds if present (convert HH:MM:SS to HH:MM)
      const startTime = startTimeRaw.substring(0, 5);
      const endTime = endTimeRaw.substring(0, 5);
      const breakMinutes = settings.default_break_duration || 30;

      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      
      const workMinutesPerDay = (endMinutes - startMinutes);
      const hoursPerDay = workMinutesPerDay / 60;
      const breakHours = breakMinutes / 60;

      console.log('🔢 Calculated hours:', {
        startMinutes,
        endMinutes,
        workMinutesPerDay,
        hoursPerDay,
        breakHours
      });

      // Use the actual calculated hours without any hardcoded corrections
      setCompanyWorkingHours({
        hoursPerDay: hoursPerDay,
        breakHours: breakHours,
        loaded: true
      });

      console.log('🕐 Company working hours loaded:', {
        startTime,
        endTime,
        breakMinutes,
        hoursPerDay,
        breakHours,
        productiveHours: hoursPerDay - breakHours
      });

    } catch (error) {
      console.error('❌ ERROR fetching company working hours:', error);
      // Set default values on error
      console.log('⚠️ Using fallback values due to error');
      setCompanyWorkingHours({
        hoursPerDay: 8,
        breakHours: 0.5,
        loaded: true
      });
    }
  };

  // Fetch employees data
  useEffect(() => {
    // Fetch company working hours from database - always load fresh data on mount
    fetchCompanyWorkingHours();
    
    const fetchEmployees = async () => {
      try {
        setEmployeesLoading(true);
        
        // Get current user and company
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) {
          console.log('No authenticated user');
          setEmployees([]);
          setEmployeesLoading(false);
          return;
        }

        // Get user's company_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.user.id)
          .single();

        if (!profile?.company_id) {
          console.log('No company_id found');
          setEmployees([]);
          setEmployeesLoading(false);
          return;
        }

        // Fetch employees with salary information
        const { data: employeesData, error } = await supabase
          .from('employees')
          .select('id, first_name, last_name, status, hourly_rate, position')
          .eq('company_id', profile.company_id);

        if (error) {
          console.error('❌ Error fetching employees:', error);
          setEmployees([]);
        } else {
          console.log('✅ Fetched employees successfully:', employeesData);
          console.log('📊 Employee details:', employeesData?.map(emp => ({
            name: `${emp.first_name} ${emp.last_name}`,
            position: emp.position,
            status: emp.status,
            hourly_rate: emp.hourly_rate,
            has_hourly_rate: emp.hourly_rate !== null && emp.hourly_rate > 0
          })));
          
          // Log warning if employees have no hourly rate
          const employeesWithoutRate = employeesData?.filter(emp => !emp.hourly_rate || emp.hourly_rate === 0) || [];
          if (employeesWithoutRate.length > 0) {
            console.warn('⚠️ Employees without hourly rate:', employeesWithoutRate.map(emp => 
              `${emp.first_name} ${emp.last_name}`
            ));
          }
          
          setEmployees(employeesData || []);
        }
      } catch (error) {
        console.error('Error in fetchEmployees:', error);
        setEmployees([]);
      } finally {
        setEmployeesLoading(false);
      }
    };

    fetchEmployees();
    fetchMonthlyData();
  }, []);

  // Reload working hours when tab changes to fixkosten or when returning to page
  useEffect(() => {
    console.log('🎯 Tab changed to:', activeTab);
    if (activeTab === 'fixkosten') {
      console.log('📍 Tab is fixkosten, fetching working hours...');
      // Load immediately when switching to fixkosten tab
      fetchCompanyWorkingHours();
      
      // Set up interval to refresh every 5 seconds while on fixkosten tab
      const interval = setInterval(() => {
        console.log('🔄 Refreshing working hours (interval)...');
        fetchCompanyWorkingHours();
      }, 5000);
      
      return () => {
        console.log('🛑 Clearing interval for working hours refresh');
        clearInterval(interval);
      };
    }
  }, [activeTab]);

  // Listen for visibility changes to refresh data when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeTab === 'fixkosten') {
        fetchCompanyWorkingHours();
      }
    };

    const handleFocus = () => {
      if (activeTab === 'fixkosten') {
        fetchCompanyWorkingHours();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeTab]);

  const fetchMonthlyData = async () => {
    // This could be replaced with a React Query hook for monthly financial data
    // For now, keeping mock data until monthly financial endpoints are implemented
    const mockMonthlyData: MonthlyRevenue[] = [
      { month: '2024-08', revenue: 22000, expenses: 16000, profit: 6000 },
      { month: '2024-09', revenue: 28000, expenses: 19000, profit: 9000 },
      { month: '2024-10', revenue: 31000, expenses: 22000, profit: 9000 },
      { month: '2024-11', revenue: 26000, expenses: 18500, profit: 7500 },
      { month: '2024-12', revenue: 35000, expenses: 24000, profit: 11000 },
      { month: '2025-01', revenue: 25000, expenses: 18000, profit: 7000 },
    ];
    
    setMonthlyData(mockMonthlyData);
  };

  const fetchInvoices = async () => {
    try {
      // Get current user's company
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        console.log('No authenticated user found, using mock data');
        setInvoices(getMockInvoices());
        calculateStats(getMockInvoices());
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) {
        console.log('No company_id found, using mock data');
        setInvoices(getMockInvoices());
        calculateStats(getMockInvoices());
        return;
      }

      // Try to fetch invoices from database
      const { data: invoicesData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (
            company_name,
            contact_person
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // If invoices table doesn't exist or other DB error, use mock data
        console.log('Database error, using mock data:', error.message);
        setInvoices(getMockInvoices());
        calculateStats(getMockInvoices());
        return;
      }

      // Use real data if available, otherwise mock data
      const finalInvoicesData = invoicesData && invoicesData.length > 0 ? invoicesData : getMockInvoices();
      setInvoices(finalInvoicesData);
      calculateStats(finalInvoicesData);

    } catch (error: unknown) {
      console.log('Error fetching invoices, using mock data:', error);
      // This will be handled by React Query hooks
    }
  };

  const getMockInvoices = () => {
    return [
      {
        id: 1,
        invoice_number: 'RE-2025-001',
        title: 'Badezimmer-Sanierung Familie Weber',
        total_amount: 8500.00,
        status: 'Versendet',
        invoice_date: '2025-01-15',
        due_date: '2025-02-14',
        customers: {
          company_name: 'Familie Weber',
          contact_person: 'Thomas Weber'
        }
      },
      {
        id: 2,
        invoice_number: 'RE-2025-002',
        title: 'Küchenumbau Müller GmbH',
        total_amount: 15200.00,
        status: 'Bezahlt',
        invoice_date: '2025-01-12',
        due_date: '2025-02-11',
        customers: {
          company_name: 'Müller GmbH',
          contact_person: 'Sandra Müller'
        }
      },
      {
        id: 3,
        invoice_number: 'RE-2025-003',
        title: 'Dacharbeiten Neubau Schmidt',
        total_amount: 12800.00,
        status: 'Offen',
        invoice_date: '2025-01-08',
        due_date: '2025-01-25', // Überfällig
        customers: {
          company_name: 'Bauunternehmen Schmidt',
          contact_person: 'Klaus Schmidt'
        }
      },
      {
        id: 4,
        invoice_number: 'RE-2024-156',
        title: 'Wartung Heizungsanlage',
        total_amount: 450.00,
        status: 'Bezahlt',
        invoice_date: '2024-12-20',
        due_date: '2025-01-19',
        customers: {
          company_name: 'Verwaltung Musterstraße',
          contact_person: 'Anna Beispiel'
        }
      }
    ];
  };

  const calculateStats = (invoicesData: InvoiceDisplay[]) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Calculate monthly revenue (current month)
    const monthlyInvoices = invoicesData.filter(invoice => {
      const invoiceDate = new Date(invoice.invoice_date);
      return invoiceDate.getMonth() === currentMonth && 
             invoiceDate.getFullYear() === currentYear;
    });

    const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
    const monthlyExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    // Calculate open invoices amount
    const openInvoices = invoicesData
      .filter(invoice => invoice.status === 'Versendet' || invoice.status === 'Offen')
      .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    // Calculate overdue invoices
    const today = new Date();
    const overdueInvoices = invoicesData.filter(invoice => {
      const dueDate = new Date(invoice.due_date);
      return dueDate < today && (invoice.status === 'Versendet' || invoice.status === 'Offen');
    });
    
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    setStats({
      monthly_revenue: monthlyRevenue,
      monthly_expenses: monthlyExpenses,
      monthly_profit: monthlyRevenue - monthlyExpenses,
      total_outstanding: openInvoices,
      overdue_count: overdueInvoices.length,
      active_projects_profit: monthlyRevenue * 1.2, // Mock calculation
      avg_profit_margin: monthlyRevenue > 0 ? ((monthlyRevenue - monthlyExpenses) / monthlyRevenue * 100) : 0,
      revenue_trend: 12.5, // Mock data
      expense_trend: -3.2,
      profit_trend: 23.1
    });
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return null;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'materials': return '🧱';
      case 'subcontractor': return '👷';
      case 'labor': return '⏰';
      case 'operating': return '🏢';
      default: return '📋';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'materials': return 'Material';
      case 'subcontractor': return 'Nachunternehmer';
      case 'labor': return 'Lohn';
      case 'operating': return 'Betriebskosten';
      default: return 'Sonstiges';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bezahlt': return 'bg-green-100 text-green-800';
      case 'Versendet':
      case 'Offen': return 'bg-yellow-100 text-yellow-800';
      case 'Storniert': return 'bg-gray-100 text-gray-800';
      case 'Entwurf': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Bezahlt': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Versendet':
      case 'Offen': return <Calendar className="h-4 w-4 text-yellow-600" />;
      case 'Entwurf': return <FileText className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const isOverdue = (invoice: InvoiceDisplay) => {
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    return dueDate < today && (invoice.status === 'Versendet' || invoice.status === 'Offen');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-6">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-12 mt-1" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="border rounded p-4">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-foreground">Finanzen & Buchhaltung</h1>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline"
            className="rounded-full"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        {/* Monatsumsatz */}
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monatsumsatz</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(stats.monthly_revenue)}
                </p>
              </div>
              <Euro className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Monatsausgaben */}
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monatsausgaben</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(stats.monthly_expenses)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Monatsgewinn */}
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monatsgewinn</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(stats.monthly_profit)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Offene Posten */}
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-muted-foreground">Offene Posten</p>
              <p className="text-2xl font-bold text-orange-700">
                {formatCurrency(stats.total_outstanding)}
              </p>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Ausgaben
          </TabsTrigger>
          <TabsTrigger value="fixkosten" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Betriebskosten
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Berichte
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Steuer
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Umsatz-Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>📊 Umsatz-Verlauf (letzte 6 Monate)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyData.map((data, index) => {
                    const month = new Date(data.month + '-01').toLocaleDateString('de-DE', { 
                      month: 'short', 
                      year: 'numeric' 
                    });
                    const maxValue = Math.max(...monthlyData.map(d => d.revenue));
                    const revenueWidth = (data.revenue / maxValue) * 100;
                    const expenseWidth = (data.expenses / maxValue) * 100;
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{month}</span>
                          <span className="font-medium">
                            {formatCurrency(data.profit)} Gewinn
                          </span>
                        </div>
                        <div className="relative h-6 bg-gray-100 rounded">
                          <div 
                            className="absolute h-full bg-green-500 rounded"
                            style={{ width: `${revenueWidth}%` }}
                          />
                          <div 
                            className="absolute h-full bg-red-400 rounded"
                            style={{ width: `${expenseWidth}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Umsatz: {formatCurrency(data.revenue)}</span>
                          <span>Ausgaben: {formatCurrency(data.expenses)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & Stats */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>⚡ Schnellzugriff</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Neue Rechnung
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Receipt className="h-4 w-4 mr-2" />
                    Ausgabe erfassen
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Euro className="h-4 w-4 mr-2" />
                    Zahlung erfassen
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    DATEV Export
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>💎 Projekt-Rentabilität</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Aktive Projekte</span>
                      <span className="font-medium">
                        {formatCurrency(stats.active_projects_profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Ø Gewinnmarge</span>
                      <Badge variant="outline">
                        {stats.avg_profit_margin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>


        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>💸 Ausgabenmanagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Expenses */}
                <div>
                  <h4 className="font-semibold mb-4">📋 Aktuelle Ausgaben</h4>
                  <div className="space-y-3">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCategoryIcon(expense.category)}</span>
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-sm text-gray-500">
                              {getCategoryName(expense.category)} • {new Date(expense.date).toLocaleDateString('de-DE')}
                            </p>
                            {expense.project && (
                              <p className="text-xs text-blue-600">→ {expense.project}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expense Categories */}
                <div>
                  <h4 className="font-semibold mb-4">📊 Ausgaben-Kategorien</h4>
                  <div className="space-y-3">
                    {['materials', 'subcontractor', 'labor', 'operating'].map(category => {
                      const categoryExpenses = expenses.filter(e => e.category === category);
                      const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
                      
                      return (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getCategoryIcon(category)}</span>
                            <span className="font-medium">{getCategoryName(category)}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(total)}</p>
                            <p className="text-sm text-gray-500">{categoryExpenses.length} Ausgaben</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 Finanzberichte & Auswertungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span>Offene Posten Liste</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <TrendingUp className="h-6 w-6" />
                  <span>Umsatzauswertung</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <BarChart3 className="h-6 w-6" />
                  <span>Projekt-Rentabilität</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Calculator className="h-6 w-6" />
                  <span>Kostenanalyse</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Euro className="h-6 w-6" />
                  <span>Liquiditätsplanung</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6" />
                  <span>Jahresauswertung</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Compliance Tab */}
        <TabsContent value="tax" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🏛️ Steuerliche Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-4">📊 Umsatzsteuer</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <span>Umsatz 19% USt</span>
                        <span className="font-medium">{formatCurrency(18000)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Umsatzsteuer 19%</span>
                        <span>{formatCurrency(3420)}</span>
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <span>Umsatz 7% USt</span>
                        <span className="font-medium">{formatCurrency(2000)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Umsatzsteuer 7%</span>
                        <span>{formatCurrency(140)}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between font-semibold">
                        <span>Gesamte USt-Schuld</span>
                        <span className="text-blue-600">{formatCurrency(3560)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">📁 Export & Berichte</h4>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      DATEV-Export
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      CSV-Export
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      EÜR-Vorbereitung
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Steuer-Einstellungen
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Betriebskosten Tab */}
        <TabsContent value="fixkosten" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Betriebskosten (jährlich) Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  💰 Betriebskosten (monatlich)
                </CardTitle>
                <CardDescription>
                  Verwalten Sie Ihre monatlichen Betriebskosten für die Stundensatz-Berechnung
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {/* Betrieb & Büro Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="text-xl">🏢</span>
                          Betrieb & Büro
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Miete/Pacht</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.miete}
                                onChange={(e) => setEditValues({...editValues, miete: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.miete} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Nebenkosten</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.nebenkosten}
                                onChange={(e) => setEditValues({...editValues, nebenkosten: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.nebenkosten} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Reinigung</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.reinigung}
                                onChange={(e) => setEditValues({...editValues, reinigung: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.reinigung} €</span>
                          )}
                        </div>
                        <hr className="my-2" />
                        <div className="flex justify-between items-center font-medium">
                          <span>Gesamt</span>
                          <span>{formatCurrency(1400)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Personal Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="text-xl">👷‍♂️</span>
                          Personal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(() => {
                          const personnelCosts = calculatePersonnelCosts();
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                  Fixgehälter Mitarbeiter ({personnelCosts.employeeCount} MA)
                                </span>
                                <span className="text-sm font-medium">{formatCurrency(personnelCosts.totalSalaries)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Arbeitgeberanteile Sozialversicherung</span>
                                <span className="text-sm font-medium">{formatCurrency(personnelCosts.socialInsurance)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Weihnachts-/Urlaubsgeld</span>
                                <span className="text-sm font-medium">{formatCurrency(personnelCosts.bonuses)}</span>
                              </div>
                              <hr className="my-2" />
                              <div className="flex justify-between items-center font-medium">
                                <span>Gesamt</span>
                                <span>{formatCurrency(personnelCosts.total)}</span>
                              </div>
                              {personnelCosts.employeeCount === 0 && (
                                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                                  ⚠️ Keine aktiven Mitarbeiter gefunden. Personalkosten sind 0 €.
                                  <br />
                                  <span className="text-xs">Stellen Sie sicher, dass Mitarbeiter einen Stundenlohn haben und aktiv sind.</span>
                                </div>
                              )}
                              {personnelCosts.employeeCount > 0 && personnelCosts.total === 0 && (
                                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                                  ⚠️ Mitarbeiter gefunden, aber keine Stundenlöhne eingetragen.
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    {/* Fahrzeuge Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="text-xl">🚗</span>
                          Fahrzeuge
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Leasing/Abschreibung</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.fahrzeugLeasing}
                                onChange={(e) => setEditValues({...editValues, fahrzeugLeasing: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.fahrzeugLeasing} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Versicherung</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.fahrzeugVersicherung}
                                onChange={(e) => setEditValues({...editValues, fahrzeugVersicherung: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.fahrzeugVersicherung} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Steuer & Wartung</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.fahrzeugSteuer}
                                onChange={(e) => setEditValues({...editValues, fahrzeugSteuer: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.fahrzeugSteuer} €</span>
                          )}
                        </div>
                        <hr className="my-2" />
                        <div className="flex justify-between items-center font-medium">
                          <span>Gesamt</span>
                          <span>{formatCurrency(9000)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    {/* Versicherungen & Beiträge Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="text-xl">🛡️</span>
                          Versicherungen & Beiträge
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Betriebshaftpflicht</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.versicherungHaftpflicht}
                                onChange={(e) => setEditValues({...editValues, versicherungHaftpflicht: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.versicherungHaftpflicht} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Berufsgenossenschaft</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.versicherungRente}
                                onChange={(e) => setEditValues({...editValues, versicherungRente: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.versicherungRente} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Kammer/Innung</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.versicherungBerufsunfaehigkeit}
                                onChange={(e) => setEditValues({...editValues, versicherungBerufsunfaehigkeit: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.versicherungBerufsunfaehigkeit} €</span>
                          )}
                        </div>
                        <hr className="my-2" />
                        <div className="flex justify-between items-center font-medium">
                          <span>Gesamt</span>
                          <span>{formatCurrency(4700)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Verwaltung & Organisation Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className="text-xl">🏭</span>
                          Verwaltung & Organisation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Software & Lizenzen</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.verwaltungSoftware}
                                onChange={(e) => setEditValues({...editValues, verwaltungSoftware: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.verwaltungSoftware} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Steuerberater</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.verwaltungSteuerberater}
                                onChange={(e) => setEditValues({...editValues, verwaltungSteuerberater: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.verwaltungSteuerberater} €</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Marketing & Werbung</span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={editValues.verwaltungMarketing}
                                onChange={(e) => setEditValues({...editValues, verwaltungMarketing: e.target.value})}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{editValues.verwaltungMarketing} €</span>
                          )}
                        </div>
                        <hr className="my-2" />
                        <div className="flex justify-between items-center font-medium">
                          <span>Gesamt</span>
                          <span>{formatCurrency(7200)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Render Saved Categories */}
                    {savedCategories.map((category) => {
                      const isEditingThisCategory = isEditing || editingCategoryId === category.id;
                      const editingData = editingCategories[category.id] || category;
                      
                      return (
                        <Card key={category.id}>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-base">
                              <div className="flex items-center gap-2">
                                {isEditingThisCategory ? (
                                  <>
                                    <Input
                                      type="text"
                                      value={editingData.icon}
                                      onChange={(e) => setEditingCategories({
                                        ...editingCategories,
                                        [category.id]: {...editingData, icon: e.target.value}
                                      })}
                                      className="w-12 h-8 text-center text-xl p-0"
                                    />
                                    <Input
                                      type="text"
                                      value={editingData.name}
                                      onChange={(e) => setEditingCategories({
                                        ...editingCategories,
                                        [category.id]: {...editingData, name: e.target.value}
                                      })}
                                      className="h-8 text-base font-semibold"
                                    />
                                  </>
                                ) : (
                                  <>
                                    <span className="text-xl">{category.icon}</span>
                                    <span>{category.name}</span>
                                  </>
                                )}
                              </div>
                              {!isEditing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSavedCategories(prev => prev.filter(c => c.id !== category.id));
                                  }}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {isEditingThisCategory ? (
                              <>
                                {editingData.items.map((item, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => {
                                        const updatedItems = [...editingData.items];
                                        updatedItems[index].name = e.target.value;
                                        setEditingCategories({
                                          ...editingCategories,
                                          [category.id]: {...editingData, items: updatedItems}
                                        });
                                      }}
                                      className="flex-1 h-7 text-sm"
                                    />
                                    <Input
                                      type="text"
                                      value={item.value}
                                      onChange={(e) => {
                                        const updatedItems = [...editingData.items];
                                        updatedItems[index].value = e.target.value;
                                        setEditingCategories({
                                          ...editingCategories,
                                          [category.id]: {...editingData, items: updatedItems}
                                        });
                                      }}
                                      className="w-20 h-7 text-right text-sm"
                                    />
                                    <span className="text-sm">€</span>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 mt-2"
                                  onClick={() => {
                                    const updatedItems = [...editingData.items, {name: '', value: '0'}];
                                    setEditingCategories({
                                      ...editingCategories,
                                      [category.id]: {...editingData, items: updatedItems}
                                    });
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Zeile hinzufügen
                                </Button>
                              </>
                            ) : (
                              <>
                                {category.items.map((item, index) => (
                                  <div key={index} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{item.name}</span>
                                    <span className="text-sm font-medium">{item.value} €</span>
                                  </div>
                                ))}
                              </>
                            )}
                            <hr className="my-2" />
                            <div className="flex justify-between items-center font-medium">
                              <span>Gesamt</span>
                              <span>
                                {formatCurrency(
                                  isEditingThisCategory 
                                    ? calculateCategoryTotal(editingData.items)
                                    : category.total
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {/* Add New Category Card */}
                    {showNewCategoryForm ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Input
                              type="text"
                              placeholder="🏢 Kategorie Name"
                              value={newCategory.name}
                              onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                              className="text-base font-semibold border-none p-0 h-auto bg-transparent"
                            />
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {newCategory.items.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                type="text"
                                placeholder="Kostenpunkt"
                                value={item.name}
                                onChange={(e) => {
                                  const updatedItems = [...newCategory.items];
                                  updatedItems[index].name = e.target.value;
                                  setNewCategory({...newCategory, items: updatedItems});
                                }}
                                className="flex-1 h-7 text-sm"
                              />
                              <Input
                                type="text"
                                placeholder="0"
                                value={item.value}
                                onChange={(e) => {
                                  const updatedItems = [...newCategory.items];
                                  updatedItems[index].value = e.target.value;
                                  setNewCategory({...newCategory, items: updatedItems});
                                }}
                                className="w-20 h-7 text-right text-sm"
                              />
                              <span className="text-sm">€</span>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7"
                            onClick={() => setNewCategory({
                              ...newCategory,
                              items: [...newCategory.items, {name: '', value: '0'}]
                            })}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Kostenpunkt hinzufügen
                          </Button>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowNewCategoryForm(false);
                                setNewCategory({name: '', icon: '💼', items: [{name: '', value: '0'}]});
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (newCategory.name && newCategory.items.some(item => item.name)) {
                                  const categoryTotal = calculateCategoryTotal(newCategory.items);
                                  const savedCategory = {
                                    id: Date.now().toString(),
                                    name: newCategory.name,
                                    icon: newCategory.icon,
                                    items: newCategory.items,
                                    total: categoryTotal
                                  };
                                  setSavedCategories(prev => [...prev, savedCategory]);
                                  setShowNewCategoryForm(false);
                                  setNewCategory({name: '', icon: '💼', items: [{name: '', value: '0'}]});
                                  toast({
                                    title: "Kategorie erstellt",
                                    description: `"${newCategory.name}" wurde erfolgreich hinzugefügt.`
                                  });
                                }
                              }}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card 
                        className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors cursor-pointer"
                        onClick={() => setShowNewCategoryForm(true)}
                      >
                        <CardContent className="flex items-center justify-center h-48 p-4">
                          <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center mx-auto mb-3 transition-colors">
                              <Plus className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Neue Kategorie</p>
                            <p className="text-xs text-gray-400 mt-1">hinzufügen</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {isEditing ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setEditingCategoryId(null);
                          setEditingCategories({});
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => {
                          // Save all custom categories
                          Object.keys(editingCategories).forEach(categoryId => {
                            const editingData = editingCategories[categoryId];
                            const updatedCategory = {
                              ...editingData,
                              total: calculateCategoryTotal(editingData.items)
                            };
                            setSavedCategories(prev => 
                              prev.map(c => c.id === categoryId ? updatedCategory : c)
                            );
                          });
                          
                          setIsEditing(false);
                          setEditingCategoryId(null);
                          setEditingCategories({});
                          toast({
                            title: "Kosten aktualisiert",
                            description: "Die Betriebskosten wurden erfolgreich gespeichert."
                          });
                        }}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsEditing(true);
                        // Initialize editing data for all saved categories
                        const editData = {};
                        savedCategories.forEach(cat => {
                          editData[cat.id] = cat;
                        });
                        setEditingCategories(editData);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stundensatz-Rechner Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  Stundensatz-Rechner
                </CardTitle>
                <CardDescription>
                  Automatische Berechnung basierend auf Betriebskosten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg">
                    <Label className="text-sm text-muted-foreground">Fixkosten (Betrieb)</Label>
                    <p className="text-2xl font-bold">{formatCurrency(calculateTotalCosts() / 12)} / Monat</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <Label className="text-sm text-muted-foreground">Variable Grundkosten</Label>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(8000 / 12)} / Monat</p>
                    <p className="text-xs text-muted-foreground mt-1">Material (netto), etc.</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <Label className="text-sm text-muted-foreground">Gewollter Gewinn</Label>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(25000 / 12)} / Monat</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-sm text-muted-foreground">Arbeitstage 2025</Label>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-semibold">261 Tage</p>
                      <Badge variant="outline">8 Stunden</Badge>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-sm text-muted-foreground">Urlaubstage:</Label>
                    <p className="text-lg">- 30 Tage</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-sm text-muted-foreground">Arbeitsstunden/Monat:</Label>
                    {companyWorkingHours.loaded ? (
                      <>
                        <p className="text-xl font-semibold">{Math.round(21.25 * companyWorkingHours.hoursPerDay)} Stunden</p>
                        <Badge variant="secondary" className="mt-2">{Math.round(21.25 * (companyWorkingHours.hoursPerDay - companyWorkingHours.breakHours))} Stunden (nach Pausen)</Badge>
                        <p className="text-xs text-muted-foreground mt-1">21,25 Tage × {Number(companyWorkingHours.hoursPerDay).toFixed(1)}h - {Number(companyWorkingHours.breakHours * 60).toFixed(0)} Min. Pausen</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Lade Arbeitszeiten...</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Label className="text-sm text-muted-foreground">Mindest-Stundensatz</Label>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatCurrency(calculateHourlyRates().minimumRate)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">({formatCurrency(calculateHourlyRates().totalAmount)} ÷ {calculateHourlyRates().workingHours}h)</p>
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg">
                    <Label className="text-sm text-muted-foreground">Empfohlener Stundensatz</Label>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(calculateHourlyRates().recommendedRate)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">+30% Gewinnaufschlag & Rücklage</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="lg">
                    <Calculator className="h-4 w-4 mr-2" />
                    Stundensatz anpassen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceModule;
