// Edge Function: Submit feedback to Slack
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type FeedbackPayload = {
  category: 'bug' | 'feature' | 'general';
  message: string;
  context?: {
    url?: string;
    user?: string;
    name?: string;
    org?: string;
    site?: string;
    env?: string;
  };
};

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function maskIdentifier(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex > 1) {
    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);
    const maskedLocal =
      local.length <= 2
        ? `${local[0]}*`
        : `${local[0]}${'*'.repeat(local.length - 2)}${local.at(-1)}`;
    return `${maskedLocal}@${domain}`;
  }
  if (trimmed.length <= 4) {
    return `${trimmed[0]}***`;
  }
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

function summarizeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  const device = ua.includes('mobile')
    ? 'Mobile'
    : ua.includes('tablet')
      ? 'Tablet'
      : 'Desktop';

  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('safari/') && !ua.includes('chrome/'))
    browser = 'Safari';
  else if (ua.includes('firefox/')) browser = 'Firefox';

  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  return `${browser} on ${os} (${device})`;
}

function canProceed(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: FeedbackPayload | null = null;
  try {
    payload = (await req.json()) as FeedbackPayload;
  } catch {
    payload = null;
  }

  if (!payload?.category || !payload?.message) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!['bug', 'feature', 'general'].includes(payload.category)) {
    return new Response(JSON.stringify({ error: 'Invalid category' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const trimmedMessage = payload.message.trim();
  if (trimmedMessage.length === 0 || trimmedMessage.length > 1000) {
    return new Response(JSON.stringify({ error: 'Invalid message length' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const clientIp = getClientIp(req);
  const rateLimitKey =
    payload.context?.user && payload.context.user !== 'anonymous'
      ? `user:${payload.context.user}`
      : `ip:${clientIp}`;
  const rateCheck = canProceed(rateLimitKey);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many submissions. Please try again later.',
        retry_after_ms: rateCheck.retryAfterMs,
      }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const webhookUrl = Deno.env.get('SLACK_FEEDBACK_WEBHOOK_URL') ?? '';
  if (!webhookUrl) {
    console.error('Missing SLACK_FEEDBACK_WEBHOOK_URL env var');
    return new Response(JSON.stringify({ error: 'Missing webhook config' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const context = payload.context ?? {};
  const rawUser =
    context.user && context.user !== 'anonymous' ? context.user : 'Anonymous';
  const userLabel = rawUser === 'Anonymous' ? rawUser : maskIdentifier(rawUser);
  const nameLabel = context.name?.trim() || 'Unknown';
  const categoryLabel =
    payload.category === 'bug'
      ? 'Bug'
      : payload.category === 'feature'
        ? 'Feature'
        : 'General';
  const userAgentSummary = summarizeUserAgent(req.headers.get('user-agent'));
  const submittedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const slackPayload = {
    text: `[${categoryLabel}] Feedback`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `[${categoryLabel}] Feedback` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Category:*\n${categoryLabel}` },
          { type: 'mrkdwn', text: `*User:*\n${nameLabel} (${userLabel})` },
          {
            type: 'mrkdwn',
            text: `*Org / Site:*\n${context.org ?? 'Unknown'}`,
          },
          { type: 'mrkdwn', text: `*Page:*\n${context.url ?? 'Unknown'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Message:*\n${trimmedMessage}` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Env: ${context.env ?? 'Unknown'} | ${userAgentSummary} | ${submittedAt}`,
          },
        ],
      },
    ],
  };

  const slackResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload),
  });

  if (!slackResponse.ok) {
    const slackBody = await slackResponse.text().catch(() => '');
    console.error('Slack request failed', {
      status: slackResponse.status,
      body: slackBody,
    });
    return new Response(
      JSON.stringify({
        error: 'Slack request failed',
        status: slackResponse.status,
        body: slackBody,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
