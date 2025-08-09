import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Ist HandwerkOS DSGVO‑konform?",
    a: "Ja. Wir legen großen Wert auf Datenschutz und Sicherheit und unterstützen eine DSGVO‑konforme Nutzung.",
  },
  {
    q: "Kann ich HandwerkOS mobil nutzen?",
    a: "Ja. HandwerkOS ist als Web‑App nutzbar und unterstützt iOS & Android über Capacitor.",
  },
  {
    q: "Wie starte ich?",
    a: "Klicken Sie auf ‘Kostenlos testen’ – die Einrichtung dauert nur wenige Minuten.",
  },
];

export default function FAQ() {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Häufige Fragen</h2>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((item, idx) => (
          <AccordionItem key={idx} value={`faq-${idx}`}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
