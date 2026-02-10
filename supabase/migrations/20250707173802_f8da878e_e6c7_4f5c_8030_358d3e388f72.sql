
-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create role enum
CREATE TYPE public.user_role AS ENUM ('manager', 'employee');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Managers can view all profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'manager'));

-- User roles policies
CREATE POLICY "Users can view their own roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can manage roles" 
  ON public.user_roles 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'manager'));

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  
  -- Default role is employee
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'employee');
  
  RETURN new;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
