-- Comprehensive Schema Fix Script
-- Run this in your Supabase SQL Editor

-- 1. Fix 'orders' table
-- Ensure 'customer_house_number' exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_house_number') THEN
        ALTER TABLE public.orders ADD COLUMN customer_house_number TEXT DEFAULT '';
    END IF;
END $$;

-- Ensure 'grand_total_final' exists (needed for admin finalization)
-- Ensure 'grand_total_final' exists (needed for admin finalization)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'grand_total_final') THEN
        ALTER TABLE public.orders ADD COLUMN grand_total_final NUMERIC;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') THEN
        ALTER TABLE public.orders ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- 2. Fix 'products' table (Just in case columns are missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price_per_250g') THEN
        ALTER TABLE public.products ADD COLUMN price_per_250g NUMERIC NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'minimum_quantity_unit') THEN
        ALTER TABLE public.products ADD COLUMN minimum_quantity_unit TEXT NOT NULL DEFAULT '250g';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category') THEN
        ALTER TABLE public.products ADD COLUMN category TEXT NOT NULL DEFAULT 'vegetable';
    END IF;
END $$;

-- 3. Verify Policies (Ensure public access for simplicity as requested)
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON public.orders;
CREATE POLICY "Orders are viewable by everyone" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE USING (true);
