-- Run this in your Supabase SQL Editor to fix the missing column error

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_house_number TEXT DEFAULT '';

-- Optional: If you have existing rows, you might want to backfill them or leave them empty.
-- The default '' ensures no errors for non-null constraints if you add one later (though we didn't add NOT NULL here for safety).
