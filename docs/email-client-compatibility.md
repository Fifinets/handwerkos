# E-Mail Client Kompatibilität

## Implementierte E-Mail Standards

Die E-Mail-Templates wurden vollständig überarbeitet um maximale Kompatibilität mit allen gängigen E-Mail-Clients zu gewährleisten.

### ✅ Implementierte Standards

#### **HTML & CSS**
- ✅ **Tabellen-Layouts**: Ausschließlich `<table>` statt Flexbox/Grid
- ✅ **Inline-CSS**: Alle Styles direkt im `style=""` Attribut
- ✅ **Websafe-Fonts**: Nur Arial, Helvetica, Verdana, sans-serif
- ✅ **Kein externes CSS**: Keine `<style>` Tags oder externe Stylesheets
- ✅ **Kein JavaScript**: Komplett statische HTML-E-Mails

#### **XHTML Doctype**
```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
```

#### **Meta Tags**
```html
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

#### **Tabellen-Struktur**
- Wrapper Table (100% width)
- Container Table (600px max-width)
- Nested Tables für Content-Bereiche
- `cellpadding="0" cellspacing="0" border="0"` auf allen Tabellen

#### **Links**
- Vollständige URLs mit `target="_blank"`
- Farben über inline CSS definiert
- Keine modernen CSS-Effekte

### **Multipart E-Mails**
Jede E-Mail wird in zwei Versionen gesendet:
- **HTML-Version**: Styled mit Tabellen-Layout
- **Plain-Text-Version**: Einfacher Text mit Zeilenmbrüchen

```
Content-Type: multipart/alternative; boundary="boundary_xyz"

--boundary_xyz
Content-Type: text/plain; charset=utf-8

[Plain Text Version]

--boundary_xyz  
Content-Type: text/html; charset=utf-8

[HTML Version]

--boundary_xyz--
```

## Client-spezifische Optimierungen

### **Microsoft Outlook**
- ✅ XHTML 1.0 Strict Doctype
- ✅ Conditional Comments für MSO
- ✅ `mso-` spezifische CSS Properties
- ✅ Feste Pixelwerte statt Prozente
- ✅ `valign` und `align` Attribute

### **Gmail**
- ✅ Inline CSS (Gmail entfernt `<style>` Tags)
- ✅ Websafe Fonts
- ✅ Tabellen-basiertes Layout
- ✅ Keine CSS-Klassen

### **Apple Mail**
- ✅ Responsive Design mit Media Queries
- ✅ WebKit-kompatible CSS
- ✅ Korrekte `viewport` Meta Tags

### **Thunderbird/Mozilla**
- ✅ Standard-konformes XHTML
- ✅ Inline CSS Styles
- ✅ Fallback-Schriftarten

## Template-Beispiele

### **E-Mail Reply Template**
```html
<table cellpadding="0" cellspacing="0" border="0" width="600">
    <tr>
        <td style="font-family: Arial, Helvetica, Verdana, sans-serif;">
            <!-- Content -->
        </td>
    </tr>
</table>
```

### **Button Styling (E-Mail-kompatibel)**
```html
<table cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td style="background-color: #2c3e50; padding: 12px 24px; border-radius: 4px;">
            <a href="https://example.com" 
               style="color: #ffffff; text-decoration: none; font-family: Arial, sans-serif;" 
               target="_blank">
                Button Text
            </a>
        </td>
    </tr>
</table>
```

## Getestete E-Mail-Clients

### **Desktop Clients**
- [ ] Microsoft Outlook 2016/2019/2021
- [ ] Apple Mail (macOS)
- [ ] Mozilla Thunderbird
- [ ] Windows 10 Mail

### **Web Clients**
- [ ] Gmail (Web)
- [ ] Outlook.com
- [ ] Yahoo Mail
- [ ] GMX / Web.de

### **Mobile Clients**
- [ ] iPhone Mail App
- [ ] Gmail Mobile App
- [ ] Outlook Mobile App
- [ ] Samsung Email

## Bekannte Limitationen

### **Outlook-spezifische Issues**
- Border-radius wird nicht unterstützt (Fallback: eckige Buttons)
- Box-shadow wird ignoriert
- CSS3 Features werden nicht unterstützt

### **Gmail-spezifische Issues**
- Automatisches Abschneiden langer E-Mails
- Entfernung von `<style>` Tags
- Konvertierung von Telefonnummern zu Links

## Debugging & Testing

### **Tools für E-Mail-Testing**
- [Litmus](https://litmus.com/) - E-Mail Previews
- [Email on Acid](https://www.emailonacid.com/) - Client Testing
- [Mailtrap](https://mailtrap.io/) - Development Testing

### **Lokales Testing**
1. HTML-Datei in Browser öffnen
2. Als .eml Datei speichern und mit E-Mail-Client öffnen
3. Test-E-Mail an verschiedene Provider senden

## Checkliste für neue Templates

- [ ] XHTML 1.0 Strict Doctype
- [ ] Nur Tabellen-Layout verwenden
- [ ] Alle CSS inline definieren
- [ ] Websafe Fonts verwenden
- [ ] Plain-Text Version erstellen
- [ ] Links mit `target="_blank"`
- [ ] Alt-Texte für Bilder
- [ ] Preheader-Text hinzufügen
- [ ] Unsubscribe-Link einbauen
- [ ] 600px maximale Breite
- [ ] Mobile Responsiveness testen