import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'

interface Entry {
  id: string
  title: string
  amount: number
  date: string
  category?: string | null
}

/**
 * RevenueExpenseSection displays an overview of monthly revenues and expenses for
 * the current company. It fetches the data from the `revenues` and
 * `expenses` tables and provides simple forms to add new entries. The totals
 * for both categories are displayed in cards and the individual entries are
 * listed below.
 */
const RevenueExpenseSection: React.FC = () => {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [revenues, setRevenues] = useState<Entry[]>([])
  const [expenses, setExpenses] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [newRevenue, setNewRevenue] = useState({ title: '', amount: '', date: '' })
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', date: '' })

  // Fetch company id and data on mount
  useEffect(() => {
    const fetchCompanyAndData = async () => {
      setLoading(true)
      // get company id from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .single()
      if (profileError) {
        console.error(profileError)
        toast({ title: 'Fehler', description: 'Firma konnte nicht geladen werden.' })
        setLoading(false)
        return
      }
      setCompanyId(profile?.company_id ?? null)
      await fetchData(profile?.company_id)
      setLoading(false)
    }
    fetchCompanyAndData()
  }, [])

  const fetchData = async (compId?: string | null) => {
    const id = compId ?? companyId
    if (!id) return
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)

    const startISO = startOfMonth.toISOString()
    const endISO = endOfMonth.toISOString()
    // Fetch revenues
    const { data: revData, error: revError } = await supabase
      .from('revenues')
      .select('*')
      .eq('company_id', id)
      .gte('date', startISO)
      .lt('date', endISO)
      .order('date', { ascending: true })
    if (revError) {
      console.error(revError)
      toast({ title: 'Fehler', description: 'Einnahmen konnten nicht geladen werden.' })
    } else {
      setRevenues(revData as Entry[])
    }
    // Fetch expenses
    const { data: expData, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', id)
      .gte('date', startISO)
      .lt('date', endISO)
      .order('date', { ascending: true })
    if (expError) {
      console.error(expError)
      toast({ title: 'Fehler', description: 'Ausgaben konnten nicht geladen werden.' })
    } else {
      setExpenses(expData as Entry[])
    }
  }

  const totalRevenues = revenues.reduce((sum, e) => sum + (e.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  const handleAddRevenue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    const amount = parseFloat(newRevenue.amount)
    if (isNaN(amount)) {
      toast({ title: 'Ungültiger Betrag', description: 'Bitte einen gültigen Betrag eingeben.' })
      return
    }
    const { error } = await supabase.from('revenues').insert({
      company_id: companyId,
      title: newRevenue.title,
      amount: amount,
      date: newRevenue.date || new Date().toISOString(),
    })
    if (error) {
      console.error(error)
      toast({ title: 'Fehler', description: 'Einnahme konnte nicht gespeichert werden.' })
    } else {
      toast({ title: 'Einnahme gespeichert', description: `${newRevenue.title} hinzugefügt.` })
      setNewRevenue({ title: '', amount: '', date: '' })
      fetchData()
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    const amount = parseFloat(newExpense.amount)
    if (isNaN(amount)) {
      toast({ title: 'Ungültiger Betrag', description: 'Bitte einen gültigen Betrag eingeben.' })
      return
    }
    const { error } = await supabase.from('expenses').insert({
      company_id: companyId,
      title: newExpense.title,
      amount: amount,
      date: newExpense.date || new Date().toISOString(),
    })
    if (error) {
      console.error(error)
      toast({ title: 'Fehler', description: 'Ausgabe konnte nicht gespeichert werden.' })
    } else {
      toast({ title: 'Ausgabe gespeichert', description: `${newExpense.title} hinzugefügt.` })
      setNewExpense({ title: '', amount: '', date: '' })
      fetchData()
    }
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-2">Einnahmen & Ausgaben (dieser Monat)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Einnahmen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalRevenues.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ausgaben</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalExpenses.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Revenue form and list */}
        <div>
          <h4 className="font-semibold mb-2">Neue Einnahme</h4>
          <form onSubmit={handleAddRevenue} className="space-y-2 mb-4">
            <input
              type="text"
              placeholder="Titel"
              value={newRevenue.title}
              onChange={(e) => setNewRevenue({ ...newRevenue, title: e.target.value })}
              className="border p-2 w-full"
            />
            <input
              type="number"
              placeholder="Betrag"
              value={newRevenue.amount}
              onChange={(e) => setNewRevenue({ ...newRevenue, amount: e.target.value })}
              className="border p-2 w-full"
            />
            <input
              type="date"
              value={newRevenue.date}
              onChange={(e) => setNewRevenue({ ...newRevenue, date: e.target.value })}
              className="border p-2 w-full"
            />
            <Button type="submit">Einnahme hinzufügen</Button>
          </form>
          <h4 className="font-semibold mb-2">Einnahmen</h4>
          {revenues.length === 0 ? (
            <p>Keine Einnahmen erfasst.</p>
          ) : (
            <ul className="space-y-1">
              {revenues.map((entry) => (
                <li key={entry.id} className="flex justify-between text-sm border-b py-1">
                  <span>
                    {entry.date?.substring(0, 10)} – {entry.title}
                  </span>
                  <span>
                    {entry.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Expense form and list */}
        <div>
          <h4 className="font-semibold mb-2">Neue Ausgabe</h4>
          <form onSubmit={handleAddExpense} className="space-y-2 mb-4">
            <input
              type="text"
              placeholder="Titel"
              value={newExpense.title}
              onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
              className="border p-2 w-full"
            />
            <input
              type="number"
              placeholder="Betrag"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
              className="border p-2 w-full"
            />
            <input
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
              className="border p-2 w-full"
            />
            <Button type="submit">Ausgabe hinzufügen</Button>
          </form>
          <h4 className="font-semibold mb-2">Ausgaben</h4>
          {expenses.length === 0 ? (
            <p>Keine Ausgaben erfasst.</p>
          ) : (
            <ul className="space-y-1">
              {expenses.map((entry) => (
                <li key={entry.id} className="flex justify-between text-sm border-b py-1">
                  <span>
                    {entry.date?.substring(0, 10)} – {entry.title}
                  </span>
                  <span>
                    {entry.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default RevenueExpenseSection
