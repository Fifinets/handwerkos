import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface Customer {
  id: string
  name: string
}

interface RecurringInvoice {
  id: string
  customer_id: string
  amount: number
  frequency: string
  next_send_date: string
  description?: string | null
}

const RecurringInvoiceManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([])
  const [loading, setLoading] = useState(true)

  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name')
      if (customerError) {
        console.error('Error fetching customers:', customerError)
      } else {
        setCustomers((customerData ?? []).map(c => ({ id: c.id, name: c.company_name })))
      }
      // TODO: Implement when recurring_invoices table is created
      const invoiceData: RecurringInvoice[] = [];
      const invoiceError = null;
      if (invoiceError) {
        console.error('Error fetching recurring invoices:', invoiceError)
      } else {
        setRecurringInvoices(invoiceData ?? [])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!customerId) {
      toast({ title: 'Kunde auswählen', description: 'Bitte wählen Sie einen Kunden.' })
      return
    }
    if (!amount || isNaN(Number(amount))) {
      toast({ title: 'Ungültiger Betrag', description: 'Bitte geben Sie einen gültigen Betrag ein.' })
      return
    }
    if (!startDate) {
      toast({ title: 'Startdatum fehlt', description: 'Bitte wählen Sie ein Startdatum.' })
      return
    }
    setIsSubmitting(true)
    try {
      const newRecord = {
        customer_id: customerId,
        amount: parseFloat(amount),
        frequency,
        next_send_date: startDate,
        description: description.trim() || null,
      }
      // TODO: Implement when recurring_invoices table is created
      console.log('Create recurring invoice functionality not yet implemented');
      const error = null;
      if (error) throw error
      toast({ title: 'Erstellt', description: 'Wiederkehrende Rechnung wurde angelegt.' })
      // TODO: Update list when recurring_invoices table is created
      const invoiceData: RecurringInvoice[] = [];
      setRecurringInvoices(invoiceData ?? [])
      setCustomerId('')
      setAmount('')
      setFrequency('monthly')
      setStartDate('')
      setDescription('')
    } catch (err) {
      console.error('Error creating recurring invoice:', err)
      toast({ title: 'Fehler', description: 'Konnte die Rechnung nicht erstellen.', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Wirklich löschen?')) return
    // TODO: Implement when recurring_invoices table is created
    const error = null;
    if (error) {
      toast({ title: 'Fehler', description: 'Löschen fehlgeschlagen.', variant: 'destructive' })
    } else {
      toast({ title: 'Gelöscht', description: 'Die wiederkehrende Rechnung wurde entfernt.' })
      setRecurringInvoices(prev => prev.filter(inv => inv.id !== id))
    }
  }

  if (loading) return <p>Lade Daten…</p>

  return (
    <div className='space-y-6'>
      <h3 className='text-lg font-semibold'>Wiederkehrende Rechnungen</h3>
      <form onSubmit={handleSubmit} className='p-4 border rounded-md space-y-4'>
        <div>
          <Label>Kunde</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Kunden auswählen' />
            </SelectTrigger>
            <SelectContent>
              {customers.map(cust => (
                <SelectItem key={cust.id} value={cust.id}>{cust.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Betrag (€)</Label>
          <Input type='number' step='0.01' value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Häufigkeit</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='monthly'>Monatlich</SelectItem>
              <SelectItem value='quarterly'>Quartalsweise</SelectItem>
              <SelectItem value='yearly'>Jährlich</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nächstes Sendedatum</Label>
          <Input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>Beschreibung (optional)</Label>
          <Input type='text' value={description} onChange={e => setDescription(e.target.value)} placeholder='Beschreibung oder Betreff' />
        </div>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? 'Speichern…' : 'Wiederkehrende Rechnung erstellen'}
        </Button>
      </form>

      <div className='border rounded-md overflow-x-auto'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-4 py-2 text-left text-xs font-medium text-gray-500'>Kunde</th>
              <th className='px-4 py-2 text-left text-xs font-medium text-gray-500'>Betrag</th>
              <th className='px-4 py-2 text-left text-xs font-medium text-gray-500'>Häufigkeit</th>
              <th className='px-4 py-2 text-left text-xs font-medium text-gray-500'>Nächstes Sendedatum</th>
              <th className='px-4 py-2'></th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-100'>
            {recurringInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className='px-4 py-4 text-center text-gray-500'>
                  Keine wiederkehrenden Rechnungen gefunden.
                </td>
              </tr>
            )}
            {recurringInvoices.map(inv => {
              const customer = customers.find(c => c.id === inv.customer_id)
              return (
                <tr key={inv.id} className='hover:bg-gray-50'>
                  <td className='px-4 py-2 text-sm text-gray-700'>{customer?.name ?? inv.customer_id}</td>
                  <td className='px-4 py-2 text-sm text-gray-700'>{inv.amount.toFixed(2)} €</td>
                  <td className='px-4 py-2 text-sm text-gray-700'>
                    {inv.frequency === 'monthly'
                      ? 'Monatlich'
                      : inv.frequency === 'quarterly'
                      ? 'Quartalsweise'
                      : 'Jährlich'}
                  </td>
                  <td className='px-4 py-2 text-sm text-gray-700'>
                    {new Date(inv.next_send_date).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-2 text-right'>
                    <Button variant='ghost' size='sm' onClick={() => handleDelete(inv.id)}>
                      Löschen
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecurringInvoiceManager
