-- Enable Row Level Security
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

-- 1. Create PRODUCTS Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    price_per_250g NUMERIC NOT NULL DEFAULT 0,
    available BOOLEAN NOT NULL DEFAULT true,
    category TEXT NOT NULL DEFAULT 'vegetable' CHECK (category IN ('fruit', 'vegetable', 'other')),
    minimum_quantity_unit TEXT NOT NULL DEFAULT '250g' CHECK (minimum_quantity_unit IN ('250g', 'packet')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products Policies (Open for simplicity as requested)
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Anyone can insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete products" ON public.products FOR DELETE USING (true);


-- 2. Create ORDERS Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_house_number TEXT NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    items JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_price_confirmation',
    grand_total_final NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orders Policies
CREATE POLICY "Orders are viewable by everyone" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE USING (true);


-- 3. Seed Initial Data
INSERT INTO public.products (name, image, price_per_250g, category, minimum_quantity_unit) VALUES
('Fresh Tomatoes', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500', 20, 'vegetable', '250g'),
('Red Onions', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500', 15, 'vegetable', '250g'),
('Potatoes', 'https://images.unsplash.com/photo-1518977676601-b53f82a6b69d?w=500', 12, 'vegetable', '250g'),
('Sweet Strawberries', 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=500', 80, 'fruit', 'packet'),
('Bananas', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500', 10, 'fruit', 'packet'),
('Green Chili', 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500', 10, 'vegetable', '250g');


ALTER TABLE public.orders
ALTER COLUMN created_at
SET DEFAULT now();
