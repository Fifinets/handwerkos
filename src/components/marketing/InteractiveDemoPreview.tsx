import React, { useState } from "react";
import {
    TrendingUp,
    FileText,
    Building2,
    Clock,
    Users,
    Package,
    Calendar,
    Mail,
    type LucideIcon,
} from "lucide-react";

// ─── Sidebar nav items ────────────────────────────────────────
interface DemoNavItem {
    id: string;
    name: string;
    icon: LucideIcon;
}

const demoNavItems: DemoNavItem[] = [
    { id: "dashboard", name: "Dashboard", icon: TrendingUp },
    { id: "angebote", name: "Angebote", icon: FileText },
    { id: "projekte", name: "Projekte", icon: Building2 },
    { id: "zeiterfassung", name: "Zeiterfassung", icon: Clock },
    { id: "kunden", name: "Kunden", icon: Users },
    { id: "material", name: "Material", icon: Package },
    { id: "planer", name: "Planer", icon: Calendar },
    { id: "emails", name: "E-Mails", icon: Mail },
];

// ─── Dashboard view ───────────────────────────────────────────
function DashboardView() {
    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Offene Angebote", value: "12", color: "#00D4FF" },
                    { label: "Projekte aktiv", value: "8", color: "#10B981" },
                    { label: "Umsatz Monat", value: "47.2k", color: "#F59E0B" },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className="p-3 rounded-xl"
                        style={{ background: "var(--premium-bg-elevated)" }}
                    >
                        <div className="text-xl font-bold" style={{ color: stat.color }}>
                            {stat.value}
                        </div>
                        <div
                            className="text-[10px] mt-1"
                            style={{ color: "var(--premium-text-dim)" }}
                        >
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div
                className="h-28 rounded-xl flex items-end justify-around px-4 pb-3"
                style={{ background: "var(--premium-bg-elevated)" }}
            >
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div
                        key={i}
                        className="w-5 rounded-t transition-all duration-500"
                        style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, #00D4FF, rgba(0,212,255,0.3))`,
                            opacity: 0.6 + i * 0.05,
                        }}
                    />
                ))}
            </div>

            {/* Recent items */}
            <div className="space-y-2">
                {[
                    { name: "Projekt Müller - Badezimmer", status: "In Arbeit", statusColor: "#00D4FF" },
                    { name: "Angebot Weber - Küche", status: "Offen", statusColor: "#F59E0B" },
                    { name: "Rechnung Schmidt", status: "Bezahlt", statusColor: "#10B981" },
                ].map((item, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 p-2.5 rounded-lg demo-list-item"
                        style={{ background: "var(--premium-bg-elevated)" }}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ background: item.statusColor }} />
                        <span className="text-xs flex-1" style={{ color: "var(--premium-text-muted)" }}>
                            {item.name}
                        </span>
                        <div
                            className="text-[10px] px-2 py-0.5 rounded"
                            style={{
                                background: `${item.statusColor}15`,
                                color: item.statusColor,
                            }}
                        >
                            {item.status}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Angebote view ────────────────────────────────────────────
function AngeboteView() {
    const offers = [
        { kunde: "Müller GmbH", titel: "Badsanierung komplett", betrag: "12.450 €", status: "Entwurf", color: "#64748B" },
        { kunde: "Weber AG", titel: "Küchenumbau", betrag: "8.200 €", status: "Versendet", color: "#F59E0B" },
        { kunde: "Schmidt & Co", titel: "Heizung erneuern", betrag: "15.800 €", status: "Angenommen", color: "#10B981" },
        { kunde: "Fischer KG", titel: "Dacharbeiten", betrag: "22.100 €", status: "In Prüfung", color: "#00D4FF" },
    ];

    return (
        <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--premium-text)" }}>
                    Aktuelle Angebote
                </span>
                <div
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "var(--premium-accent-subtle)", color: "var(--premium-accent)" }}
                >
                    4 offen
                </div>
            </div>

            {/* Offer cards */}
            {offers.map((o, i) => (
                <div
                    key={i}
                    className="p-3 rounded-xl demo-list-item"
                    style={{ background: "var(--premium-bg-elevated)" }}
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: "var(--premium-text)" }}>
                            {o.kunde}
                        </span>
                        <span
                            className="text-[10px] px-2 py-0.5 rounded"
                            style={{ background: `${o.color}15`, color: o.color }}
                        >
                            {o.status}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                            {o.titel}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "var(--premium-accent)" }}>
                            {o.betrag}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Projekte view ────────────────────────────────────────────
function ProjekteView() {
    const projects = [
        { name: "Badsanierung Müller", progress: 75, team: 3, status: "Aktiv" },
        { name: "Küchenumbau Weber", progress: 30, team: 2, status: "Aktiv" },
        { name: "Heizungstausch Schmidt", progress: 90, team: 4, status: "Fast fertig" },
        { name: "Dachsanierung Fischer", progress: 10, team: 2, status: "Neu" },
    ];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--premium-text)" }}>
                    Laufende Projekte
                </span>
                <div
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}
                >
                    4 aktiv
                </div>
            </div>

            {projects.map((p, i) => (
                <div
                    key={i}
                    className="p-3 rounded-xl demo-list-item"
                    style={{ background: "var(--premium-bg-elevated)" }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: "var(--premium-text)" }}>
                            {p.name}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                            {p.team} Mitarbeiter
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${p.progress}%`,
                                background: p.progress > 70 ? "#10B981" : p.progress > 40 ? "#F59E0B" : "#00D4FF",
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                            {p.status}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: "var(--premium-text-muted)" }}>
                            {p.progress}%
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Zeiterfassung view ───────────────────────────────────────
function ZeiterfassungView() {
    const entries = [
        { mitarbeiter: "Max Bauer", projekt: "Badsanierung Müller", stunden: "7.5h", zeit: "08:00 – 15:30" },
        { mitarbeiter: "Lisa Kern", projekt: "Küchenumbau Weber", stunden: "6.0h", zeit: "09:00 – 15:00" },
        { mitarbeiter: "Tom Wagner", projekt: "Heizungstausch", stunden: "8.0h", zeit: "07:00 – 15:00" },
        { mitarbeiter: "Anna Meier", projekt: "Dachsanierung", stunden: "5.5h", zeit: "10:00 – 15:30" },
    ];

    return (
        <div className="space-y-3">
            {/* Summary bar */}
            <div
                className="p-3 rounded-xl flex items-center justify-between"
                style={{ background: "var(--premium-bg-elevated)" }}
            >
                <div>
                    <div className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>Heute gesamt</div>
                    <div className="text-lg font-bold" style={{ color: "#00D4FF" }}>27.0h</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>Mitarbeiter aktiv</div>
                    <div className="text-lg font-bold" style={{ color: "#10B981" }}>4</div>
                </div>
            </div>

            {/* Entries */}
            {entries.map((e, i) => (
                <div
                    key={i}
                    className="p-3 rounded-xl demo-list-item"
                    style={{ background: "var(--premium-bg-elevated)" }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: "var(--premium-text)" }}>
                            {e.mitarbeiter}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "#00D4FF" }}>
                            {e.stunden}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                            {e.projekt}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                            {e.zeit}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Placeholder view for unimplemented modules ───────────────
function PlaceholderView({ name, icon: Icon }: { name: string; icon: LucideIcon }) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[260px] gap-4">
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--premium-accent-subtle)" }}
            >
                <Icon className="w-7 h-7" style={{ color: "var(--premium-accent)" }} />
            </div>
            <span className="text-sm font-medium" style={{ color: "var(--premium-text-muted)" }}>
                {name}
            </span>
            <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                Modul-Vorschau kommt bald
            </span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────
export function InteractiveDemoPreview() {
    const [activeView, setActiveView] = useState("dashboard");
    const [sidebarVisible, setSidebarVisible] = useState(false);

    const renderView = () => {
        switch (activeView) {
            case "dashboard":
                return <DashboardView />;
            case "angebote":
                return <AngeboteView />;
            case "projekte":
                return <ProjekteView />;
            case "zeiterfassung":
                return <ZeiterfassungView />;
            default: {
                const item = demoNavItems.find((n) => n.id === activeView);
                return <PlaceholderView name={item?.name ?? ""} icon={item?.icon ?? TrendingUp} />;
            }
        }
    };

    return (
        <div
            className="relative rounded-2xl border"
            style={{
                background: "var(--premium-bg-card)",
                borderColor: "var(--premium-border)",
            }}
        >
            {/* Browser Chrome */}
            <div
                className="flex items-center gap-2 px-4 py-3 border-b rounded-t-2xl"
                style={{ borderColor: "var(--premium-border)" }}
            >
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div
                    className="flex-1 mx-4 h-6 rounded-md flex items-center px-3"
                    style={{ background: "var(--premium-bg-elevated)" }}
                >
                    <span className="text-[10px]" style={{ color: "var(--premium-text-dim)" }}>
                        app.handwerkos.de
                    </span>
                </div>
            </div>

            {/* App Layout: Sidebar + Content */}
            <div className="flex overflow-hidden rounded-b-2xl relative" style={{ minHeight: 340 }}>
                {/* Invisible hover trigger zone on the left edge */}
                <div
                    className="absolute left-0 top-0 bottom-0 z-10"
                    style={{ width: 24 }}
                    onMouseEnter={() => setSidebarVisible(true)}
                />

                {/* Mini Sidebar – slides in from left on hover */}
                <div
                    className="demo-sidebar flex flex-col items-center py-3 gap-1 border-r z-20"
                    style={{
                        width: sidebarVisible ? 48 : 0,
                        minWidth: sidebarVisible ? 48 : 0,
                        opacity: sidebarVisible ? 1 : 0,
                        background: "var(--premium-bg)",
                        borderColor: sidebarVisible ? "var(--premium-border)" : "transparent",
                        transition: "width 0.3s cubic-bezier(0.22,1,0.36,1), min-width 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
                        overflow: "hidden",
                    }}
                    onMouseEnter={() => setSidebarVisible(true)}
                    onMouseLeave={() => setSidebarVisible(false)}
                >
                    {/* Logo */}
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 flex-shrink-0"
                        style={{ background: "var(--premium-accent-subtle)", border: "1px solid rgba(0,212,255,0.2)" }}
                    >
                        <span className="text-xs font-bold" style={{ color: "var(--premium-accent)" }}>
                            H
                        </span>
                    </div>

                    {/* Nav Items */}
                    {demoNavItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className="demo-sidebar-item flex-shrink-0"
                            data-active={activeView === item.id}
                            title={item.name}
                        >
                            <item.icon className="w-4 h-4" />
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 p-4 overflow-hidden">
                    <div key={activeView} className="demo-view-enter">
                        {renderView()}
                    </div>
                </div>
            </div>

            {/* Live Demo Badge */}
            <div
                className="absolute bottom-3 right-3 px-4 py-2 rounded-full text-sm font-medium shadow-lg"
                style={{
                    background: "var(--premium-gradient)",
                    color: "var(--premium-bg)",
                }}
            >
                Live Demo
            </div>
        </div>
    );
}
