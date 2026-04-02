# Future Integration Strategy: Webbuilder -> ERP

## Overview
Currently, the Webbuilder operates as an isolated MVP. It stores all business and legal data directly in the `sites` table (`web_profile` and `legal_profile` JSONB columns) instead of linking to the core `companies` or `profiles` tables. This allows for rapid iteration without touching critical ERP data.

## Integration Plan
When we are ready to integrate with the main ERP/Marketplace, we will perform the following steps:

1.  **Add Foreign Key**:
    - Add `company_id` column to `sites` table.
    - `ALTER TABLE sites ADD COLUMN company_id UUID REFERENCES companies(id);`

2.  **Data Migration & Mapping**:
    - Create a background job to scan all `sites` where `company_id` is NULL.
    - For each site:
        - Check if a `company` exists for the `site.user_id` with a matching name.
        - IF MATCH: Link `site.company_id` to that company.
        - IF NO MATCH: Create a new `company` record using data from `site.web_profile` and `site.legal_profile`.

3.  **Sync Mechanism**:
    - Implement a trigger or service that updates `sites.web_profile` when the linked `company` record is updated, and vice-versa, or deprecate the JSONB columns in favor of direct joins.

## Mapping Logic (MVP -> ERP)
| Webbuilder (sites.web_profile / legal_profile) | ERP (companies / profiles) |
| :--- | :--- |
| `web_profile.companyName` | `companies.name` |
| `web_profile.cityRegion` | `companies.city` |
| `web_profile.services` | `companies.services` (or tags) |
| `legal_profile.owner` | `profiles.full_name` (if owner) |
| `legal_profile.vatId` | `companies.vat_id` |
| `legal_profile.address` | `companies.address` |
| `web_profile.contact.email` | `companies.contact_email` |

## Note
For now, always write to `sites` JSONB columns. Do not read/write to `companies` tables from the Webbuilder context.
