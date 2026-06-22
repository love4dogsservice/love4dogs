# Love 4 Dogs — Business Tool

Invoice and schedule management for Millie Ruth & Ayres.

## Supabase Setup

Go to Supabase → SQL Editor and run this (if you haven't already run the invoices table SQL, run that first):

### Update invoices table (add new columns)
```sql
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS service_period_start DATE,
ADD COLUMN IF NOT EXISTS service_period_end DATE;
```

### Create schedule table
```sql
CREATE TABLE schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  dog_name TEXT,
  job_date DATE NOT NULL,
  job_time TIME,
  service_type INT DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON schedule FOR ALL USING (true) WITH CHECK (true);
```

## Environment Variables (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://ggkqpzzmmqunoatpiaip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Features
- Invoice management with auto-numbering
- Service dropdown with auto-calculate pricing
- Date pickers for service period and line items
- Mark invoices paid/unpaid
- Email, text, copy, print invoices
- Delete invoices with confirmation
- **Schedule/Calendar tab** — add jobs by day with time and reminders
- PWA — add to home screen as an app with Love 4 Dogs logo icon
