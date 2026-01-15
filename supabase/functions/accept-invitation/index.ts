// Supabase Edge Function for accepting invitations
// This function creates the auth user using service role (bypasses signup restrictions)
// and then finalizes the invitation acceptance
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

interface AcceptInvitationRequest {
  token: string;
  email: string;
  password: string;
}

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
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: Missing Supabase credentials',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let requestBody: AcceptInvitationRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in request body',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { token, email, password } = requestBody;

    if (!token || !email || !password) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: token, email, or password',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({
          error: 'Password must be at least 6 characters',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase admin client (uses service role key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Validate the invitation token first
    const { data: validationData, error: validationError } =
      await supabaseAdmin.rpc('validate_invitation_token', {
        token: token,
      });

    if (validationError) {
      return new Response(
        JSON.stringify({
          error: `Failed to validate invitation: ${validationError.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!validationData || validationData.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid invitation token',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const validation = validationData[0];
    if (!validation.is_valid) {
      return new Response(
        JSON.stringify({
          error: validation.error_message || 'Invitation is not valid',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify email matches invitation
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== validation.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: 'Email does not match the invitation',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Create the auth user using admin API (bypasses signup restrictions)
    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true, // Mark as verified since invite link is the verification
      });

    if (createError || !createdUser?.user) {
      return new Response(
        JSON.stringify({
          error: createError?.message || 'Failed to create user account',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = createdUser.user.id;

    // Step 3: Finalize invitation acceptance in the database
    const { data: acceptData, error: acceptError } = await supabaseAdmin.rpc(
      'accept_invitation',
      {
        token: token,
        user_id: userId,
        user_email: normalizedEmail,
      }
    );

    if (acceptError) {
      // Cleanup: delete the user if invitation acceptance fails
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {
        // Ignore cleanup errors
      });

      return new Response(
        JSON.stringify({
          error: `Failed to accept invitation: ${acceptError.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // accept_invitation returns a table; take the first row
    const result = Array.isArray(acceptData) ? acceptData[0] : acceptData;
    if (!result?.success) {
      // Cleanup: delete the user if invitation acceptance failed
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {
        // Ignore cleanup errors
      });

      return new Response(
        JSON.stringify({
          error: result?.error_message || 'Invitation acceptance failed',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Success!
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: normalizedEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in accept-invitation function:', error);
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
