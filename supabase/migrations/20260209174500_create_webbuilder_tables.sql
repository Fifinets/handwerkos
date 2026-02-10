-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL, -- 'plumber', 'electrician', etc.
  preview_image TEXT,
  default_theme_config JSONB DEFAULT '{}'::jsonb,
  default_pages JSONB DEFAULT '[]'::jsonb,
  default_blocks JSONB DEFAULT '[]'::jsonb,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id),
  title TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  theme_config JSONB DEFAULT '{}'::jsonb,
  status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, -- '/', '/services', '/contact'
  title TEXT NOT NULL,
  seo_meta JSONB DEFAULT '{}'::jsonb,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(site_id, slug)
);

-- Create blocks table
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'hero', 'features', 'text', 'image', 'contact_form'
  content JSONB DEFAULT '{}'::jsonb,
  styles JSONB DEFAULT '{}'::jsonb,
  "order" INTEGER DEFAULT 0,
  schema_version INTEGER DEFAULT 1,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create web_leads table
CREATE TABLE IF NOT EXISTS web_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  status TEXT CHECK (status IN ('new', 'contacted', 'converted', 'archived')) DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create site_legal_data table (placeholder for future integration)
CREATE TABLE IF NOT EXISTS site_legal_data (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  company_name TEXT,
  owner TEXT,
  address TEXT,
  vat_id TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- Add RLS policies (Basic setup)

-- Templates: Readable by everyone (authenticated), Insert/Update by admin only (skipping admin check for MVP, assume service role for seeding)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates are viewable by everyone" ON templates FOR SELECT USING (true);

-- Sites: Users can only see/edit their own sites
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sites" ON sites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sites" ON sites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sites" ON sites FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sites" ON sites FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Public access to published sites (for rendering) - This will likely be handled by a separate function or edge function, but enabling read for public if published is good practice
CREATE POLICY "Public read access to published sites" ON sites FOR SELECT USING (status = 'published');

-- Pages: Users can only see/edit pages of their own sites
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view pages of own sites" ON pages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = pages.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can insert pages to own sites" ON pages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = pages.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can update pages of own sites" ON pages FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = pages.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can delete pages of own sites" ON pages FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = pages.site_id AND sites.user_id = auth.uid())
);
-- Public access to pages of published sites
CREATE POLICY "Public read access to published site pages" ON pages FOR SELECT USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = pages.site_id AND sites.status = 'published')
);


-- Blocks: Users can only see/edit blocks of their own sites
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view blocks of own sites" ON blocks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM pages JOIN sites ON pages.site_id = sites.id WHERE pages.id = blocks.page_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can insert blocks to own sites" ON blocks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM pages JOIN sites ON pages.site_id = sites.id WHERE pages.id = blocks.page_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can update blocks of own sites" ON blocks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM pages JOIN sites ON pages.site_id = sites.id WHERE pages.id = blocks.page_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can delete blocks of own sites" ON blocks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pages JOIN sites ON pages.site_id = sites.id WHERE pages.id = blocks.page_id AND sites.user_id = auth.uid())
);
-- Public access to blocks of published sites
CREATE POLICY "Public read access to published site blocks" ON blocks FOR SELECT USING (
  EXISTS (SELECT 1 FROM pages JOIN sites ON pages.site_id = sites.id WHERE pages.id = blocks.page_id AND sites.status = 'published')
);

-- Web Leads: Insert public, Select owner only
ALTER TABLE web_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert leads" ON web_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view leads of own sites" ON web_leads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = web_leads.site_id AND sites.user_id = auth.uid())
);

-- Legal Data: Same as Sites
ALTER TABLE site_legal_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own legal data" ON site_legal_data FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = site_legal_data.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can insert own legal data" ON site_legal_data FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = site_legal_data.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can update own legal data" ON site_legal_data FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.id = site_legal_data.site_id AND sites.user_id = auth.uid())
);

