#!/bin/bash

# Diagnostic script to check email digest setup and test the function
# This helps determine if everything is configured correctly

set -e

echo "🔍 Email Digest Diagnostic Check"
echo "=================================="
echo ""

# Check if service role key is provided
if [ -z "$1" ]; then
    echo "Usage: ./check-email-digest-status.sh YOUR_SERVICE_ROLE_KEY"
    echo ""
    echo "This script will:"
    echo "  1. Test the Edge Function"
    echo "  2. Show detailed response"
    echo "  3. Provide troubleshooting steps"
    echo ""
    exit 1
fi

SERVICE_ROLE_KEY=$1
PROJECT_URL="https://qyzlqvfdmxvestditilq.supabase.co"
FUNCTION_URL="${PROJECT_URL}/functions/v1/send-email-digest"

echo "📡 Testing Edge Function..."
echo ""

# Make request and capture both status and body
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"frequency": "daily"}')

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESPONSE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v jq &> /dev/null; then
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "$BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 INTERPRETATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Parse response
if echo "$BODY" | grep -q '"success"'; then
    SUCCESS=$(echo "$BODY" | grep -o '"success":[^,}]*' | cut -d: -f2 | tr -d ' "')
    USERS=$(echo "$BODY" | grep -o '"usersProcessed":[^,}]*' | cut -d: -f2 | tr -d ' "')
    SENT=$(echo "$BODY" | grep -o '"emailsSent":[^,}]*' | cut -d: -f2 | tr -d ' "')
    FAILED=$(echo "$BODY" | grep -o '"emailsFailed":[^,}]*' | cut -d: -f2 | tr -d ' "')
    
    if [ "$SUCCESS" = "true" ]; then
        echo "✅ Function executed successfully!"
        echo ""
        echo "   Users with digest enabled: $USERS"
        echo "   Emails sent: $SENT"
        echo "   Emails failed: $FAILED"
        echo ""
        
        if [ "$USERS" = "0" ]; then
            echo "ℹ️  No users found with daily digest enabled."
            echo "   This is normal if:"
            echo "   - Migration hasn't been applied yet"
            echo "   - No users have enabled email digest in their preferences"
            echo ""
            echo "   To test:"
            echo "   1. Apply migration: migrations/add_email_digest_preferences.sql"
            echo "   2. Go to Profile → Notification Preferences"
            echo "   3. Enable 'Email digest' and set frequency to 'Daily'"
            echo "   4. Run this test again"
        elif [ "$SENT" -gt 0 ]; then
            echo "✅ Successfully sent $SENT email digest(s)!"
            echo "   Check the recipient email inboxes."
        else
            echo "ℹ️  Function ran but no emails were sent."
            echo "   Possible reasons:"
            echo "   - Users have no unread notifications"
            echo "   - Email sending failed (check function logs)"
        fi
    else
        echo "❌ Function returned success=false"
        echo ""
        ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
        echo "   Error: $ERROR_MSG"
    fi
elif echo "$BODY" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
    echo "❌ Function returned an error"
    echo ""
    echo "   Error: $ERROR_MSG"
    echo ""
    echo "   Common causes:"
    echo "   1. Migration not applied"
    echo "   2. Missing environment variables"
    echo "   3. Database function doesn't exist"
else
    echo "⚠️  Unexpected response format"
    echo "   HTTP Status: $HTTP_STATUS"
    echo "   Response: $BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TROUBLESHOOTING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Check function logs:"
echo "   https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions/send-email-digest/logs"
echo ""
echo "2. Verify migration applied:"
echo "   Run in Supabase SQL Editor:"
echo "   SELECT proname FROM pg_proc WHERE proname = 'get_users_for_email_digest';"
echo ""
echo "3. Check environment variables:"
echo "   Supabase Dashboard → Edge Functions → send-email-digest → Settings"
echo "   Required: RESEND_API_KEY, EMAIL_FROM_ADDRESS"
echo ""
echo "4. Test with a user who has digest enabled:"
echo "   - Go to Profile → Notification Preferences"
echo "   - Enable 'Email digest' → Set to 'Daily'"
echo "   - Create some test notifications"
echo "   - Run this test again"
echo ""
