#!/bin/bash

# Quick test script to trigger the email digest function and see what happens
# This will show you exactly what the function returns

set -e

if [ -z "$1" ]; then
    echo "❌ Missing service role key"
    echo ""
    echo "Usage: ./test-email-digest-now.sh YOUR_SERVICE_ROLE_KEY"
    echo ""
    echo "Get it from: Supabase Dashboard → Settings → API → service_role key"
    echo ""
    exit 1
fi

SERVICE_ROLE_KEY=$1
PROJECT_URL="https://qyzlqvfdmxvestditilq.supabase.co"
FUNCTION_URL="${PROJECT_URL}/functions/v1/send-email-digest"

echo "🚀 Testing send-email-digest function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make the request
echo "📡 Calling function..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"frequency": "daily"}')

# Extract HTTP code and body
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESPONSE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Format output
if command -v jq &> /dev/null; then
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "$BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 ANALYSIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check HTTP status
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP Status: $HTTP_CODE (Success)"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "❌ HTTP Status: $HTTP_CODE (Server Error)"
    echo ""
    echo "Common causes:"
    echo "  1. Migration not applied - Run: migrations/add_email_digest_preferences.sql"
    echo "  2. Missing environment variables in function settings"
    echo "  3. Database function doesn't exist"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "❌ HTTP Status: $HTTP_CODE (Authentication Failed)"
    echo "   Check your service role key"
else
    echo "⚠️  HTTP Status: $HTTP_CODE"
fi

echo ""

# Parse response for key info
if echo "$BODY" | grep -q '"success"'; then
    if echo "$BODY" | grep -q '"success":true'; then
        echo "✅ Function executed successfully!"
        
        # Extract numbers
        USERS=$(echo "$BODY" | grep -o '"usersProcessed":[0-9]*' | cut -d: -f2 || echo "0")
        SENT=$(echo "$BODY" | grep -o '"emailsSent":[0-9]*' | cut -d: -f2 || echo "0")
        
        echo "   Users processed: $USERS"
        echo "   Emails sent: $SENT"
        echo ""
        
        if [ "$USERS" = "0" ]; then
            echo "ℹ️  No users found with daily digest enabled."
            echo "   This is normal if:"
            echo "   - Migration hasn't been applied"
            echo "   - No users have enabled digest in Profile → Notification Preferences"
        fi
    else
        echo "❌ Function returned success=false"
        ERROR=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "Unknown")
        echo "   Error: $ERROR"
    fi
elif echo "$BODY" | grep -q '"error"'; then
    ERROR=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "Unknown")
    echo "❌ Function error: $ERROR"
    echo ""
    if echo "$ERROR" | grep -q "Missing required configuration"; then
        echo "   → Check environment variables in:"
        echo "     Supabase Dashboard → Edge Functions → send-email-digest → Settings"
        echo ""
        echo "   Required:"
        echo "     - SUPABASE_URL"
        echo "     - SUPABASE_SERVICE_ROLE_KEY"
        echo "     - RESEND_API_KEY"
        echo "     - EMAIL_FROM_ADDRESS"
    elif echo "$ERROR" | grep -q "function.*does not exist"; then
        echo "   → Migration not applied!"
        echo "     Run: migrations/add_email_digest_preferences.sql"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Check function logs (should now have entries):"
echo "   https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions/send-email-digest/logs"
echo ""
echo "2. Verify migration applied:"
echo "   Run: docs/debugging/check-email-digest-prerequisites.sql in SQL Editor"
echo ""
echo "3. Check environment variables:"
echo "   Dashboard → Edge Functions → send-email-digest → Settings"
echo ""
