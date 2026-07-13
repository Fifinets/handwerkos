
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Send } from 'lucide-react';
import { OfferWithRelations } from '@/types/offer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/hooks/useApi';
import { getPublicBaseUrl } from '@/lib/publicUrl';

interface OfferEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    offer: OfferWithRelations;
    onSent?: () => Promise<void> | void;
}

const emailSchema = z.object({
    recipient: z.string().email('Ungültige E-Mail-Adresse'),
    cc: z.string().optional(),
    subject: z.string().min(1, 'Betreff ist erforderlich'),
    message: z.string().min(1, 'Nachricht ist erforderlich'),
    attachPdf: z.boolean().default(true),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export function OfferEmailDialog({ open, onOpenChange, offer, onSent }: OfferEmailDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSending, setIsSending] = useState(false);

    const form = useForm<EmailFormValues>({
        resolver: zodResolver(emailSchema),
        mode: 'onChange',
        defaultValues: {
            recipient: offer.customer?.email || '',
            subject: `Angebot ${offer.offer_number}: ${offer.project_name}`,
            message: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser Angebot für das Projekt "${offer.project_name}".\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIhr HandwerkOS Team`,
            attachPdf: true,
        },
    });
    const recipient = form.watch('recipient');
    const canSend = Boolean(recipient?.trim()) && !isSending;

    const onSubmit = async (data: EmailFormValues) => {
        setIsSending(true);
        try {
            const { error } = await supabase.functions.invoke('send-offer-email', {
                body: {
                    offerId: offer.id,
                    recipientEmail: data.recipient,
                    cc: data.cc || undefined,
                    subject: data.subject,
                    message: data.message,
                    attachPdf: data.attachPdf,
                    publicBaseUrl: getPublicBaseUrl(),
                },
            });

            if (error) throw error;

            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers });
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offer(offer.id) });
            await onSent?.();

            toast({
                title: 'E-Mail gesendet',
                description: `Das Angebot wurde an ${data.recipient} gesendet.`,
            });
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Fehler',
                description: 'E-Mail konnte nicht gesendet werden.',
                variant: 'destructive',
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Angebot per E-Mail senden</DialogTitle>
                    <DialogDescription>
                        Senden Sie das Angebot direkt an den Kunden.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="recipient" className="text-right">An</Label>
                        <div className="col-span-3">
                            <Input id="recipient" {...form.register('recipient')} />
                            {form.formState.errors.recipient && <p className="text-sm text-red-500">{form.formState.errors.recipient.message}</p>}
                            {!recipient?.trim() && (
                                <p className="text-sm text-amber-600">Bitte tragen Sie eine Empfängeradresse ein.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cc" className="text-right">CC</Label>
                        <div className="col-span-3">
                            <Input id="cc" {...form.register('cc')} placeholder="Optional" />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="subject" className="text-right">Betreff</Label>
                        <div className="col-span-3">
                            <Input id="subject" {...form.register('subject')} />
                            {form.formState.errors.subject && <p className="text-sm text-red-500">{form.formState.errors.subject.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <Label htmlFor="message" className="text-right pt-2">Nachricht</Label>
                        <div className="col-span-3">
                            <Textarea id="message" className="h-40" {...form.register('message')} />
                            {form.formState.errors.message && <p className="text-sm text-red-500">{form.formState.errors.message.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Anhang</Label>
                        <div className="col-span-3 flex items-center gap-2">
                            <Switch
                                checked={form.watch('attachPdf')}
                                onCheckedChange={(checked) => form.setValue('attachPdf', checked)}
                            />
                            <span className="text-sm text-muted-foreground">Kundenlink zum Angebot mitsenden</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                        <Button type="submit" disabled={!canSend}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Senden
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
