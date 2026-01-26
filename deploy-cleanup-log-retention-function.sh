#!/bin/bash

# Script to deploy the cleanup-log-retention Edge Function
# Run this after logging in to Supabase

echo "🚀 Deploying cleanup-log-retention Edge Function..."
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
npx supabase functions deploy cleanup-log-retention

echo ""
echo "✅ Done! Check your Supabase dashboard to verify the function is deployed."
echo "   Dashboard: https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions"
echo ""
echo "📋 Next steps:"
echo "   1. Apply the migration: migrations/add_log_retention_cleanup_function.sql"
echo "   2. Set up a scheduled cron job to call this function daily"
echo "   3. See docs/LOG_RETENTION.md for scheduling options"
