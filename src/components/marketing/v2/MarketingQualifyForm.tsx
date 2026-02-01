import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowRight, Sparkles } from "lucide-react";

export default function MarketingQualifyForm() {
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState(1);
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulate submission
        setTimeout(() => {
            setOpen(false);
            setStep(1);
            toast({
                title: "Erfolgreich eingetragen!",
                description: "Wir melden uns in Kürze bei dir.",
            });
        }, 1000);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {/* We can use a hidden trigger or wrap the actual buttons. 
            For this implementation, let's create a global floating button OR 
            assume the buttons in Hook/CTA sections map to this.
            Ideally, we wrap the specific buttons.
            Since the buttons are in other components, we might just render the trigger here 
            and use a portal or Context, OR simply re-implement the button visually here for the main CTA area.
            
            BETTER APPROACH: This component EXPORTS the Dialog but implies it wraps the trigger. 
            We will wrap the standard button here to show usage.
         */}
                <button className="hidden">Trigger</button>
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
                            <Select required>
                                <SelectTrigger className="bg-white/5 border-gray-700">
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
                            <Select required>
                                <SelectTrigger className="bg-white/5 border-gray-700">
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
                            <Input className="bg-white/5 border-gray-700" placeholder="z.B. Excel, Papier, andere Software..." />
                        </div>

                        <div className="space-y-2">
                            <Label>4. Was hindert dich aktuell am meisten?</Label>
                            <Textarea className="bg-white/5 border-gray-700" placeholder="Beschreibe dein größtes Hindernis..." />
                        </div>

                        <div className="space-y-2">
                            <Label>5. Email für die Warteliste</Label>
                            <Input type="email" required className="bg-white/5 border-gray-700" placeholder="deine@email.de" />
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-6">
                        Jetzt Bewerbung absenden
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
