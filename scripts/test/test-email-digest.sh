#!/bin/bash

# Test script for send-email-digest Edge Function
# This will trigger the function to test if it works

set -e

echo "🧪 Testing send-email-digest Edge Function..."
echo ""

# Check if service role key is provided
if [ -z "$1" ]; then
    echo "Usage: ./test-email-digest.sh YOUR_SERVICE_ROLE_KEY [frequency]"
    echo ""
    echo "Get your service role key from:"
    echo "  Supabase Dashboard → Settings → API → service_role key"
    echo ""
    echo "Frequency options: daily (default) or weekly"
    exit 1
fi

SERVICE_ROLE_KEY=$1
FREQUENCY=${2:-daily}

if [ "$FREQUENCY" != "daily" ] && [ "$FREQUENCY" != "weekly" ]; then
    echo "❌ Invalid frequency. Must be 'daily' or 'weekly'"
    exit 1
fi

PROJECT_URL="https://qyzlqvfdmxvestditilq.supabase.co"
FUNCTION_URL="${PROJECT_URL}/functions/v1/send-email-digest"

echo "📡 Calling Edge Function..."
echo "   URL: $FUNCTION_URL"
echo "   Frequency: $FREQUENCY"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"frequency\": \"$FREQUENCY\"}")

# Extract status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 Response:"
echo "   HTTP Status: $HTTP_CODE"
echo "   Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Function executed successfully!"
    echo ""
    echo "Check the response above for:"
    echo "  - usersProcessed: Number of users with digest enabled"
    echo "  - emailsSent: Number of emails successfully sent"
    echo "  - emailsFailed: Number of emails that failed"
else
    echo "❌ Function returned error status: $HTTP_CODE"
    echo ""
    echo "Common issues:"
    echo "  1. Check that the migration has been applied (add_email_digest_preferences.sql)"
    echo "  2. Verify environment variables are set in Supabase Dashboard"
    echo "  3. Check function logs in Supabase Dashboard → Edge Functions → send-email-digest → Logs"
fi
