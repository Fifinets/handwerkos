# HandwerkOS Product Roadmap & Backlog

This document captures high-level feature ideas, strategic goals, and technical improvements discussed during development.

## 🚀 Strategic Features (The "Killer Features")

### 1. Connection: Project -> Marketing (References)
*   **Goal:** Turn completed projects into marketing assets automatically.
*   **Concept:**
    *   One-click workflow: "Post Project to Website".
    *   Selects best "after" photos from the project documentation.
    *   Generates a SEO-optimized project description (using AI/Template).
    *   Publishes as a new "Reference" case on the user's HandwerkOS-built website.

### 2. Customer Portal & Scheduling
*   **Goal:** reduce administrative overhead for appointments.
*   **Concept:**
    *   Self-service booking for customers on the Handwerker website.
    *   Deep integration with `PlannerModule` and `EmployeeWageManagement`.
    *   Configurable slots based on service type (e.g., "Maintenance" = 1h, "Consultation" = 2h).

## 🛠️ Industry Standards (Must-Haves for Pros)

### 3. GAEB Interface (Public Tenders)
*   **Priority:** High (Essential for larger commercial/public projects)
*   **Features:**
    *   Import GAEB files (phases X83, D83, P83).
    *   Export offers as GAEB (X84, D84).
    *   Validation against current GAEB XML standards.

### 4. IDS / Open Masterdata (Wholesaler Integration)
*   **Priority:** High (Essential for HVAC/Elektro efficiency)
*   **Features:**
    *   OCI/IDS connect to major whistleblower shops (GC-Gruppe, Würth, etc.).
    *   Import article data (DATANORM/Open Masterdata) directly into `MaterialModule`.
    *   Live price checks in the specific `OfferCreationWizard`.

## 📦 Core Improvements

### 5. Advanced OCR & Automation
*   Extend `OCRInvoiceModule` to handle delivery notes (`DeliveryNotesManager`).
*   Auto-match delivery notes to invoices.

## 📝 Backlog
*   [ ] Refine "Aufmaß" functionality (potentially separate module or deep integration in Offer/Invoice).
*   [ ] Mobile App: Offline mode for construction sites (poor signal areas).
