export default function FeatureShowcase() {
  const accent = "#06b6d4";

  return (
    <section className="py-24" style={{ background: "var(--premium-bg)" }}>
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-20 space-y-4">
          <div
            className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[3px]"
            style={{ color: accent }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Die Lösung
          </div>
          <h2 className="premium-headline text-3xl md:text-5xl">
            Alles in einer Plattform
          </h2>
          <p className="premium-subline max-w-lg mx-auto">
            Vom Kundenkontakt bis zum DATEV-Export.
          </p>
        </div>

        {/* Feature Rows — 1:1 from mockup */}
        <div className="max-w-5xl mx-auto" style={{ display: "flex", flexDirection: "column", gap: "80px" }}>

          {/* Row 1: Dashboard */}
          <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", color: accent, fontWeight: 600, marginBottom: "8px" }}>
                Dashboard
              </div>
              <h3 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px", color: "#f8fafc" }}>
                Echtzeit-Überblick
              </h3>
              <p style={{ fontSize: "15px", color: "#64748b", lineHeight: 1.7 }}>
                Umsatz, Auslastung, offene Posten — alles auf einen Blick.
              </p>
            </div>
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "16px",
              padding: "24px",
              minHeight: "240px",
            }}>
              <div style={{ fontSize: "36px", fontWeight: 700, marginBottom: "4px", color: "#22c55e" }}>
                €142.800
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Umsatz Q1
              </div>
              <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", height: "80px", marginTop: "16px" }}>
                {[
                  { h: "30%", bg: "rgba(6,182,212,0.15)" },
                  { h: "45%", bg: "rgba(6,182,212,0.2)" },
                  { h: "60%", bg: "rgba(6,182,212,0.3)" },
                  { h: "52%", bg: "rgba(6,182,212,0.35)" },
                  { h: "72%", bg: "rgba(6,182,212,0.45)" },
                  { h: "80%", bg: "rgba(6,182,212,0.55)" },
                  { h: "88%", bg: "rgba(6,182,212,0.7)" },
                  { h: "100%", bg: accent },
                ].map((bar, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: bar.h,
                      background: bar.bg,
                      borderRadius: "3px 3px 0 0",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Projekte (reversed) */}
          <div style={{ display: "flex", gap: "32px", alignItems: "center", flexDirection: "row-reverse" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", color: accent, fontWeight: 600, marginBottom: "8px" }}>
                Projekte
              </div>
              <h3 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px", color: "#f8fafc" }}>
                Vom Angebot zur Rechnung
              </h3>
              <p style={{ fontSize: "15px", color: "#64748b", lineHeight: 1.7 }}>
                Jedes Projekt im Blick. Status, Budget, Nachkalkulation.
              </p>
            </div>
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "16px",
              padding: "24px",
            }}>
              {[
                { name: "EFH Müller", status: "Aktiv", bg: "rgba(34,197,94,0.12)", color: "#4ade80" },
                { name: "Altbau Hauptstr.", status: "Material", bg: "rgba(234,179,8,0.12)", color: "#facc15" },
                { name: "PV-Anlage Schmidt", status: "Angebot", bg: `rgba(6,182,212,0.12)`, color: accent },
                { name: "Ladestation TG", status: "Aktiv", bg: "rgba(34,197,94,0.12)", color: "#4ade80" },
              ].map((item, i, arr) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    fontSize: "13px",
                    color: "#cbd5e1",
                  }}
                >
                  <span>{item.name}</span>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: 600,
                    background: item.bg,
                    color: item.color,
                  }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: KI-Kalkulation */}
          <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", color: accent, fontWeight: 600, marginBottom: "8px" }}>
                KI-Kalkulation
              </div>
              <h3 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px", color: "#f8fafc" }}>
                Angebote in 2 Minuten
              </h3>
              <p style={{ fontSize: "15px", color: "#64748b", lineHeight: 1.7 }}>
                KI lernt aus deinen Projekten und schlägt Preise vor.
              </p>
            </div>
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "16px",
              padding: "24px",
              minHeight: "240px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center" as const,
            }}>
              <div style={{ fontSize: "56px", fontWeight: 700, color: accent }}>
                &lt; 2 Min
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                statt 45 Min
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}