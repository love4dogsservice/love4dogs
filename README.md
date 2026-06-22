# Love 4 Dogs — Business Tool

Invoice management app for Millie Ruth & Ayres.

## Setup

### 1. Supabase — Create the database table

Go to your Supabase project → SQL Editor → run this:

```sql
CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  dog_name TEXT,
  service_period TEXT,
  special_notes TEXT,
  payment_notes TEXT,
  rows JSONB DEFAULT '[]',
  total DECIMAL(10,2) DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since no auth for now)
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true) WITH CHECK (true);
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://ggkqpzzmmqunoatpiaip.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Install and run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

1. Push this repo to GitHub
2. Go to vercel.com → New Project → import your GitHub repo
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## Features

- Create invoices with auto-numbered IDs
- Service dropdown with automatic price calculation
  - Dog Walking / Playtime: $2.50/15min (rounds up)
  - Feeding & Potty Break: $4.00/visit
  - Potty Break Only: $3.00/visit
- Save invoices to Supabase
- View all invoices — unpaid and paid
- Mark invoices as paid/unpaid
- Email invoice (opens Gmail)
- Text invoice (opens Messages)
- Copy invoice to clipboard
- Print invoice
- Edit or delete any invoice
