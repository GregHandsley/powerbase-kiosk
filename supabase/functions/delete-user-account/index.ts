// Edge Function: Delete User Account (GDPR-safe)
// This function handles both auth user deletion and app-level data anonymization
//
// Usage: Called from Profile page after password verification
// Security: Requires authentication, user can only delete their own account

// Deno globals are available at runtime; declare a minimal type to satisfy TypeScript.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight - return 200 OK for better browser compatibility
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client (anon key for user auth)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with the user's auth token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated by getting the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('Error getting user in Edge Function:', userError);
      return new Response(
        JSON.stringify({ error: `Not authenticated: ${userError.message}` }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get request body (should contain password for verification)
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password) {
      return new Response(JSON.stringify({ error: 'Password is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify password by attempting sign-in
    const { error: verifyError } = await supabaseClient.auth.signInWithPassword(
      {
        email: user.email!,
        password: password,
      }
    );

    if (verifyError) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client for user deletion
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Anonymize app-level data using RPC function
    // Use user-authenticated client so auth.uid() is populated inside the function.
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      'delete_user_account',
      {
        user_id: user.id,
      }
    );

    if (rpcError) {
      console.error('Error calling delete_user_account RPC:', rpcError);
      return new Response(
        JSON.stringify({
          error: `Failed to anonymize account data: ${rpcError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (rpcResult && rpcResult.success === false) {
      return new Response(
        JSON.stringify({
          error: rpcResult.error || 'Failed to delete account',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Delete/ban the auth user
    // Option A: Hard delete (removes user completely)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    // Option B: Soft ban (keeps user but prevents login)
    // Uncomment this and comment out the delete above if you prefer banning:
    // const { error: deleteError } = await supabaseAdmin.auth.admin.updateUserById(
    //   user.id,
    //   { ban_duration: '876000h' } // ~100 years (effectively permanent)
    // );

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      // Even if auth deletion fails, app data is already anonymized
      // Return partial success with warning
      return new Response(
        JSON.stringify({
          success: true,
          warning:
            'Account data anonymized, but auth user deletion failed. User may still be able to log in.',
          error: deleteError.message,
        }),
        {
          status: 200, // Return 200 since data is anonymized
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error in delete-user-account function:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
