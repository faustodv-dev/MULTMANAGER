import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define allowed origins for CORS security
const getAllowedOrigins = (): string[] => {
  const frontendUrl = Deno.env.get('FRONTEND_URL');
  const origins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://multmanager.lovable.app',
    'https://lovable.dev',
  ];
  
  if (frontendUrl) {
    origins.push(frontendUrl);
  }
  
  return origins;
};

const getCorsOrigin = (req: Request): string => {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigins = getAllowedOrigins();
  
  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // Check for Lovable preview domains pattern
  if (
    origin.includes('.lovable.app') ||
    origin.includes('.lovable.dev') ||
    origin.includes('.lovableproject.com')
  ) {
    return origin;
  }
  
  return allowedOrigins[0];
};

const getCorsHeaders = (req: Request): Record<string, string> => {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify caller is authenticated and is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' })

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { email, password, full_name, department_id, unit_id, role } = await req.json()

    // Validate required fields
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Email, password and full_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate full_name length (prevent excessively long names)
    if (typeof full_name !== 'string' || full_name.length < 2 || full_name.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Full name must be between 2 and 200 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role if provided
    const validRoles = ['admin', 'unit_admin', 'manager', 'employee'];
    if (role && !validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate department_id format if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (department_id && !uuidRegex.test(department_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid department ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate unit_id format if provided
    if (unit_id && !uuidRegex.test(unit_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid unit ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key to create users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create the user using admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: { full_name: full_name.substring(0, 200) } // Ensure truncation
    })

    if (createError) {
      // Return generic error message to avoid leaking internal details
      console.error('User creation error:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user. Please check the email is not already in use.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The trigger handle_new_user should have already created the profile and role
    // But we'll update department_id, unit_id and role if provided
    if (department_id || unit_id || role) {
      // Update profile with department_id and unit_id if provided
      const profileUpdates: Record<string, string> = {};
      if (department_id) profileUpdates.department_id = department_id;
      if (unit_id) profileUpdates.unit_id = unit_id;
      
      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', newUser.user.id)
      }

      // Update role if different from default (employee)
      if (role && role !== 'employee') {
        await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', newUser.user.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email,
          full_name 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    // Log the actual error for debugging, but return generic message
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})