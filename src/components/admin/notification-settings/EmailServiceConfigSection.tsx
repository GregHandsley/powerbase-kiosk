import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { sendEmail } from '../../../services/email/emailService';
import toast from 'react-hot-toast';

export function EmailServiceConfigSection() {
  const { user } = useAuth();
  const [isSendingTest, setIsSendingTest] = useState(false);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Email Service Configuration
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Email service configuration is managed via environment variables for
            security.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-md p-4">
          <p className="text-sm text-slate-300 mb-3">
            Configure these environment variables in your Supabase Edge Function
            settings:
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-start gap-2">
              <span className="text-indigo-400">RESEND_API_KEY</span>
              <span className="text-slate-400">=</span>
              <span className="text-slate-300">
                Your Resend API key (starts with re_)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-400">EMAIL_FROM_ADDRESS</span>
              <span className="text-slate-400">=</span>
              <span className="text-slate-300">noreply@yourdomain.com</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-400">EMAIL_FROM_NAME</span>
              <span className="text-slate-400">=</span>
              <span className="text-slate-300">Powerbase Kiosk (optional)</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-700 rounded-md p-3">
          <p className="text-xs text-blue-300">
            <strong>How to set environment variables:</strong>
          </p>
          <ol className="text-xs text-blue-200 mt-2 ml-4 list-decimal space-y-1">
            <li>Go to your Supabase Dashboard</li>
            <li>Navigate to Edge Functions → send-email</li>
            <li>Click "Settings" or "Environment Variables"</li>
            <li>Add the three variables above</li>
            <li>Redeploy the function</li>
          </ol>
        </div>

        <div className="pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-400">
            <strong>Security Note:</strong> API keys and email configuration are
            stored as environment variables in Supabase Edge Functions, not in
            the database. This prevents unauthorized access through the UI.
          </p>
        </div>

        {/* Test Email Button */}
        <div className="pt-4 border-t border-slate-700">
          <div className="space-y-2">
            <button
              type="button"
              onClick={async () => {
                if (!user?.email) {
                  toast.error('Unable to determine your email address');
                  return;
                }

                setIsSendingTest(true);
                try {
                  const testEmailHtml = `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <style>
                          body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            background-color: #0f172a;
                            color: #cbd5e1;
                            padding: 20px;
                          }
                          .container {
                            background-color: #1e293b;
                            border-radius: 8px;
                            padding: 24px;
                            max-width: 600px;
                            margin: 0 auto;
                          }
                          h1 {
                            color: #f1f5f9;
                            margin-top: 0;
                          }
                          p {
                            line-height: 1.6;
                          }
                          .success {
                            background-color: #065f46;
                            border: 1px solid #10b981;
                            border-radius: 6px;
                            padding: 12px;
                            margin: 16px 0;
                            color: #d1fae5;
                          }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <h1>✅ Test Email Successful!</h1>
                          <p>This is a test email from your Powerbase Kiosk notification system.</p>
                          <div class="success">
                            <strong>Email Configuration:</strong><br>
                            Sent at: ${new Date().toLocaleString()}
                          </div>
                          <p>If you received this email, your email service is configured correctly and ready to send notifications.</p>
                        </div>
                      </body>
                    </html>
                  `;

                  const result = await sendEmail({
                    to: user.email,
                    subject: 'Test Email - Powerbase Kiosk',
                    html: testEmailHtml,
                  });

                  if (result.success) {
                    toast.success(
                      `Test email sent successfully to ${user.email}`
                    );
                  } else {
                    toast.error(result.error || 'Failed to send test email');
                  }
                } catch (error) {
                  console.error('Error sending test email:', error);
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Failed to send test email'
                  );
                } finally {
                  setIsSendingTest(false);
                }
              }}
              disabled={isSendingTest || !user?.email}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingTest ? 'Sending...' : 'Send Test Email'}
            </button>
            {user?.email && (
              <p className="text-xs text-slate-400">
                Test email will be sent to:{' '}
                <span className="font-mono text-slate-300">{user.email}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
