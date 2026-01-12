// Supabase Edge Function for sending emails via Resend
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  fromName?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get email configuration from environment variables (secure)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailFromAddress = Deno.env.get('EMAIL_FROM_ADDRESS');
    const emailFromName = Deno.env.get('EMAIL_FROM_NAME') || 'Powerbase Kiosk';

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Resend API key not configured. Set RESEND_API_KEY environment variable.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!emailFromAddress) {
      return new Response(
        JSON.stringify({
          error:
            'From email address not configured. Set EMAIL_FROM_ADDRESS environment variable.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let emailRequest: EmailRequest;
    try {
      emailRequest = await req.json();
    } catch (err) {
      console.error('Failed to parse request body:', err);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Format the "from" field properly
    // Resend requires: "email@example.com" or "Name <email@example.com>"
    let fromField: string;

    if (emailRequest.from) {
      fromField = emailRequest.from;
    } else {
      const email = emailFromAddress.trim();
      const name = emailFromName.trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: `Invalid email address format: ${email}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Format: "Name <email>" if name exists, otherwise just "email"
      if (name) {
        fromField = `${name} <${email}>`;
      } else {
        fromField = email;
      }
    }

    // Send email
    const { data, error } = await resend.emails.send({
      from: fromField,
      to: Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to],
      subject: emailRequest.subject,
      html: emailRequest.html,
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to send email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log email to database
    await supabaseClient.from('email_sent_log').insert({
      to_email: Array.isArray(emailRequest.to)
        ? emailRequest.to[0]
        : emailRequest.to,
      subject: emailRequest.subject,
      template_name: emailRequest.subject.toLowerCase().includes('reminder')
        ? 'reminder'
        : 'alert',
      metadata: {
        resend_id: data?.id,
        to: emailRequest.to,
      },
    });

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
