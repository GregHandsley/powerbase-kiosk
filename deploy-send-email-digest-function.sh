#!/bin/bash

# Script to deploy the send-email-digest Edge Function
# Run this after logging in to Supabase

echo "🚀 Deploying send-email-digest Edge Function..."
echo ""

# Check if supabase is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

# Link to project (if not already linked)
echo "📎 Linking to project..."
npx supabase link --project-ref qyzlqvfdmxvestditilq

# Deploy the function
echo ""
echo "📦 Deploying function..."
npx supabase functions deploy send-email-digest

echo ""
echo "✅ Done! Check your Supabase dashboard to verify the function is deployed."
echo "   Dashboard: https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions"
echo ""
echo "📋 Next steps:"
echo "   1. Apply the migration: migrations/add_email_digest_preferences.sql"
echo "   2. Set up environment variables in Supabase Dashboard → Edge Functions → send-email-digest:"
echo "      - RESEND_API_KEY"
echo "      - EMAIL_FROM_ADDRESS"
echo "      - EMAIL_FROM_NAME (optional)"
echo "      - APP_URL (optional, for links in emails)"
echo "   3. Set up scheduled cron jobs in Supabase Dashboard → Database → Cron Jobs:"
echo "      - Daily digest: Run daily at 8 AM UTC"
echo "      - Weekly digest: Run weekly on Monday at 8 AM UTC"
echo "   4. To test manually:"
echo "      curl -X POST https://qyzlqvfdmxvestditilq.supabase.co/functions/v1/send-email-digest \\"
echo "        -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"frequency\": \"daily\"}'"
