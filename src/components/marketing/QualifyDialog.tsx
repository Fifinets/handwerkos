import React, { useState } from "react";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const QualifyDialog = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Form State
    const [formData, setFormData] = useState({
        situation: "",
        goal: "",
        tried: "",
        obstacle: "",
        email: ""
    });

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('waitlist')
                .insert([
                    {
                        situation: formData.situation,
                        goal: formData.goal,
                        tried: formData.tried,
                        obstacle: formData.obstacle,
                        email: formData.email
                    }
                ]);

            if (error) throw error;

            toast({
                title: "Erfolgreich eingetragen!",
                description: "Wir melden uns in Kürze bei dir.",
            });
            setTimeout(() => {
                setOpen(false);
                setFormData({
                    situation: "",
                    goal: "",
                    tried: "",
                    obstacle: "",
                    email: ""
                });
            }, 1000);
        } catch (error) {
            console.error('Error submitting to waitlist:', error);
            toast({
                title: "Fehler",
                description: "Da ist etwas schiefgelaufen. Bitte versuche es später noch einmal.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-[#1a1f2e] border-gray-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-500" />
                        Bewerbung für Founder-Status
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Bitte beantworte diese 5 kurzen Fragen, damit wir sehen, ob HandwerkOS zu dir passt.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>1. Wo stehst du aktuell?</Label>
                            <Select required onValueChange={(val) => handleChange('situation', val)} value={formData.situation}>
                                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                                    <SelectValue placeholder="Wähle deine Situation" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="start">Gründung / Startphase</SelectItem>
                                    <SelectItem value="small">Kleines Team (1-5 MA)</SelectItem>
                                    <SelectItem value="mid">Wachstumsphase (6-15 MA)</SelectItem>
                                    <SelectItem value="large">Etablierter Betrieb (&gt;15 MA)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Was ist dein wichtigstes Ziel?</Label>
                            <Select required onValueChange={(val) => handleChange('goal', val)} value={formData.goal}>
                                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                                    <SelectValue placeholder="Wähle dein Ziel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="time">Mehr Zeit / Weniger Stress</SelectItem>
                                    <SelectItem value="money">Höhere Marge / Gewinn</SelectItem>
                                    <SelectItem value="growth">Wachstum / Skalierung</SelectItem>
                                    <SelectItem value="control">Bessere Übersicht</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>3. Was hast du schon probiert?</Label>
                            <Input
                                className="bg-white/5 border-gray-700 text-white"
                                placeholder="z.B. Excel, Papier..."
                                value={formData.tried}
                                onChange={(e) => handleChange('tried', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>4. Was hindert dich aktuell am meisten?</Label>
                            <Textarea
                                className="bg-white/5 border-gray-700 text-white"
                                placeholder="Beschreibe dein größtes Hindernis..."
                                value={formData.obstacle}
                                onChange={(e) => handleChange('obstacle', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>5. Email für die Warteliste</Label>
                            <Input
                                type="email"
                                required
                                className="bg-white/5 border-gray-700 text-white"
                                placeholder="deine@email.de"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                            />
                        </div>
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-6">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Jetzt Bewerbung absenden"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};
