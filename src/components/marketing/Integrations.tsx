import React from "react";
import { Card } from "@/components/ui/card";
import { Mail, Calendar } from "lucide-react";

const integrations = [
  {
    title: "Gmail / IMAP",
    desc: "E‑Mails synchronisieren und Projekten zuordnen.",
    Icon: Mail,
  },
  {
    title: "Google Kalender",
    desc: "Termine und Einsätze direkt im Kalender planen.",
    Icon: Calendar,
  },
];

export default function Integrations() {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Direkte Integrationen</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {integrations.map(({ title, desc, Icon }) => (
          <Card key={title} className="p-6 flex items-center gap-4 hover-scale">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">{title}</h3>
              <p className="text-muted-foreground">{desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
