import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

interface Signature {
  id: string
  name: string
  content: string
  is_default: boolean
}

/**
 * EmailSignatureManager provides CRUD operations for user signatures. A user can
 * create multiple signatures, mark one as default, edit its name or content,
 * and delete unnecessary signatures. Signatures are stored in the
 * `email_signatures` table with a reference to `user_id`. The currently
 * authenticated user is determined via Supabase auth.
 */
const EmailSignatureManager: React.FC = () => {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [newSig, setNewSig] = useState({ name: '', content: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', content: '' })

  const fetchSignatures = async () => {
    setLoading(true)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) {
      console.error(userError)
      toast({ title: 'Fehler', description: 'Benutzer konnte nicht abgerufen werden.' })
      setLoading(false)
      return
    }
    const userId = user?.id
    if (!userId) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    if (error) {
      console.error(error)
      toast({ title: 'Fehler', description: 'Signaturen konnten nicht geladen werden.' })
    } else {
      setSignatures(data as Signature[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSignatures()
  }, [])

  const handleAddSignature = async (e: React.FormEvent) => {
    e.preventDefault()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      toast({ title: 'Fehler', description: 'Benutzer konnte nicht abgerufen werden.' })
      return
    }
    const { error } = await supabase.from('email_signatures').insert({
      user_id: user.id,
      name: newSig.name,
      content: newSig.content,
      is_default: signatures.length === 0,
    })
    if (error) {
      console.error(error)
      toast({ title: 'Fehler', description: 'Signatur konnte nicht gespeichert werden.' })
    } else {
      toast({ title: 'Signatur gespeichert' })
      setNewSig({ name: '', content: '' })
      fetchSignatures()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('email_signatures').delete().eq('id', id)
    if (error) {
      console.error(error)
      toast({ title: 'Fehler', description: 'Signatur konnte nicht gelöscht werden.' })
    } else {
      toast({ title: 'Signatur gelöscht' })
      fetchSignatures()
    }
  }

  const startEdit = (sig: Signature) => {
    setEditingId(sig.id)
    setEditData({ name: sig.name, content: sig.content })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    const { error } = await supabase
      .from('email_signatures')
      .update({ name: editData.name, content: editData.content })
      .eq('id', editingId)
    if (error) {
      console.error(error)
      toast({ title: 'Fehler', description: 'Signatur konnte nicht aktualisiert werden.' })
    } else {
      toast({ title: 'Signatur aktualisiert' })
      setEditingId(null)
      setEditData({ name: '', content: '' })
      fetchSignatures()
    }
  }

  const setDefault = async (id: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id
    if (!userId) return
    const { error: resetError } = await supabase
      .from('email_signatures')
      .update({ is_default: false })
      .eq('user_id', userId)
    if (resetError) {
      console.error(resetError)
      toast({ title: 'Fehler', description: 'Default konnte nicht gesetzt werden.' })
      return
    }
    const { error: setError } = await supabase
      .from('email_signatures')
      .update({ is_default: true })
      .eq('id', id)
    if (setError) {
      console.error(setError)
      toast({ title: 'Fehler', description: 'Signatur konnte nicht als Standard gesetzt werden.' })
    } else {
      toast({ title: 'Standard geändert' })
      fetchSignatures()
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Signaturen verwalten</h3>
      <form onSubmit={handleAddSignature} className="space-y-2 border p-4 rounded-md">
        <h4 className="font-medium">Neue Signatur</h4>
        <input
          type="text"
          placeholder="Name der Signatur"
          value={newSig.name}
          onChange={(e) => setNewSig({ ...newSig, name: e.target.value })}
          className="border p-2 w-full"
        />
        <textarea
          placeholder="Signaturinhalt"
          value={newSig.content}
          onChange={(e) => setNewSig({ ...newSig, content: e.target.value })}
          className="border p-2 w-full h-24"
        />
        <Button type="submit">Signatur erstellen</Button>
      </form>
      <div>
        <h4 className="font-medium mb-2">Vorhandene Signaturen</h4>
        {loading ? (
          <p>Lade...</p>
        ) : signatures.length === 0 ? (
          <p>Keine Signaturen vorhanden.</p>
        ) : (
          <ul className="space-y-2">
            {signatures.map((sig) => (
              <li key={sig.id} className="border p-3 rounded-md">
                {editingId === sig.id ? (
                  <form onSubmit={handleUpdate} className="space-y-1">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="border p-1 w-full"
                    />
                    <textarea
                      value={editData.content}
                      onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                      className="border p-1 w-full h-20"
                    />
                    <div className="flex space-x-2">
                      <Button size="sm" type="submit">
                        Speichern
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="font-semibold flex items-center justify-between">
                      <span>{sig.name}</span>
                      {sig.is_default && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                          Standard
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 whitespace-pre-line">{sig.content}</div>
                    <div className="mt-2 flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(sig)}>
                        Bearbeiten
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(sig.id)}>
                        Löschen
                      </Button>
                      {!sig.is_default && (
                        <Button size="sm" variant="secondary" onClick={() => setDefault(sig.id)}>
                          Als Standard setzen
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default EmailSignatureManager
