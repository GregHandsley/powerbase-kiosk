// Edge Function: Process Organization Logo
// Handles logo upload, resizing, and storage
//
// Usage: Called from client to upload and process organization logos
// Security: Requires authentication, validates file types and sizes

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
  console.log('Request received:', {
    method: req.method,
    url: req.url,
    hasAuth: req.headers.get('Authorization') ? 'yes' : 'no',
    hasApiKey: req.headers.get('apikey') ? 'yes' : 'no',
  });

  // Handle CORS preflight
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
    const authHeader =
      req.headers.get('Authorization') ?? req.headers.get('authorization');
    console.log('Auth header received:', authHeader ? 'present' : 'missing');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase clients
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

    // Client for user authentication and permission checks
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Client for storage operations (service role)
    const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify user is authenticated
    console.log('Attempting to get user...');
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    console.log('User auth result:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
    });

    if (userError || !user) {
      console.log('Authentication failed:', userError?.message || 'No user');
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: userError?.message ?? 'No user found',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('logo') as File;
    const organizationId = formData.get('organizationId') as string;

    if (!file || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing logo file or organization ID' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate organization ID
    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid organization ID' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user can manage branding for this organization
    console.log('Checking permissions for org:', orgId, 'user:', user.id);
    const { data: canManage, error: authCheckError } = await supabaseClient.rpc(
      'can_manage_org_branding',
      {
        p_organization_id: orgId,
        p_user_id: user.id,
      }
    );

    console.log('Permission check result:', {
      canManage,
      error: authCheckError?.message,
      errorCode: authCheckError?.code,
    });

    if (authCheckError || !canManage) {
      console.log('Permission check failed');
      return new Response(
        JSON.stringify({
          error: 'Insufficient permissions',
          details: authCheckError?.message ?? null,
          errorCode: authCheckError?.code ?? null,
          canManage: !!canManage,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'File must be an image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      return new Response(
        JSON.stringify({ error: 'File size must be less than 5MB' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate filename with org-based folder structure
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];

    if (!allowedExtensions.includes(fileExt)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use org-based folder: org-<org_id>/logo.<ext>
    const fileName = `org-${orgId}/logo.${fileExt}`;

    // For SVG files, upload directly without processing
    if (fileExt === 'svg') {
      const { error } = await supabaseAdminClient.storage
        .from('org-logos')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabaseAdminClient.storage
        .from('org-logos')
        .getPublicUrl(fileName);

      return new Response(
        JSON.stringify({
          success: true,
          logoUrl: urlData.publicUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For other image formats, upload as-is (client can handle resizing if needed)
    const { error } = await supabaseAdminClient.storage
      .from('org-logos')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabaseAdminClient.storage
      .from('org-logos')
      .getPublicUrl(fileName);

    if (!urlData.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    return new Response(
      JSON.stringify({
        success: true,
        logoUrl: urlData.publicUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-org-logo function:', error);
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
