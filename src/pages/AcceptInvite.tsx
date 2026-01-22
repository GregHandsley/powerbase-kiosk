// src/pages/AcceptInvite.tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import {
  validateInvitationToken,
  type InvitationValidationResult,
} from '../utils/invitations';

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] =
    useState<InvitationValidationResult | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setLoading(false);
      setValidating(false);
      return;
    }

    async function validateToken() {
      try {
        setValidating(true);
        // token is guaranteed to be string here due to early return above
        const result = await validateInvitationToken(token as string);
        setInvitation(result);

        if (!result.is_valid) {
          setError(result.error_message || 'Invalid invitation');
        }
      } catch (err) {
        console.error('Error validating token:', err);
        setError('Failed to validate invitation token');
      } finally {
        setLoading(false);
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token || !invitation || !invitation.is_valid) {
      setError('Invalid invitation');
      return;
    }

    if (!fullName || fullName.trim().length === 0) {
      setError('Full name is required');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!invitation.email) {
      setError('Invalid invitation: missing email');
      return;
    }

    setSubmitting(true);

    try {
      // Call the Edge Function to create user and accept invitation
      // This uses the service role to bypass signup restrictions
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/accept-invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            // Supabase Edge Functions require an Authorization header
            // Using anon key here; function uses service role internally
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            token: token,
            email: invitation.email.toLowerCase(),
            password: password,
            full_name: fullName.trim(),
          }),
        }
      ).catch((error) => {
        // Handle network errors (including CORS)
        console.error('Network error calling Edge Function:', error);
        throw new Error(
          'Failed to connect to invitation service. Please ensure the Edge Function is deployed.'
        );
      });

      // Check if response is ok before parsing JSON
      let result;
      try {
        const text = await response.text();
        if (!text) {
          throw new Error(
            `Empty response from server (${response.status}): ${response.statusText}`
          );
        }
        result = JSON.parse(text);
      } catch (jsonError) {
        console.error('Failed to parse response:', jsonError);
        throw new Error(
          `Server error (${response.status}): ${response.statusText}. The Edge Function may not be deployed or is returning an invalid response.`
        );
      }

      if (!response.ok) {
        // Log the full error for debugging
        console.error('Edge Function error:', {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          fullResult: result,
        });

        // Check if user already exists
        if (
          result.error?.includes('already registered') ||
          result.error?.includes('already exists')
        ) {
          setError(
            'An account with this email already exists. Please sign in instead.'
          );
          setSubmitting(false);
          return;
        }

        // Show the actual error message from the server
        const errorMessage =
          result.error ||
          `Server error (${response.status}): ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Success! Now sign the user in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email.toLowerCase(),
        password: password,
      });

      if (signInError) {
        // Account was created but sign-in failed
        setError(
          'Account created successfully, but automatic sign-in failed. Please sign in manually.'
        );
        setSubmitting(false);
        return;
      }

      // Success!
      setSuccess(true);

      // Auto-redirect to home after a brief delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to accept invitation. Please try again.'
      );
      setSubmitting(false);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-300 text-sm">Validating invitation...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl p-6 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2 text-slate-100">
              Account Created!
            </h1>
            <p className="text-sm text-slate-300">
              Your account has been created successfully. Redirecting...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation || !invitation.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md glass-panel rounded-2xl p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold mb-2 text-slate-100">
              Invalid Invitation
            </h1>
            <p className="text-sm text-red-400">
              {error ||
                invitation?.error_message ||
                'This invitation is invalid or has expired.'}
            </p>
          </div>
          <div className="mt-6">
            <a
              href="/login"
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Go to login →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2 text-slate-100">
            Accept Invitation
          </h1>
          <p className="text-sm text-slate-300">
            Create your account to join the organization.
          </p>
          {invitation.email && (
            <p className="text-sm text-slate-400 mt-2">
              Email: <span className="text-slate-200">{invitation.email}</span>
            </p>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-200">
              Full Name
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              autoFocus
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-200">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">
              Must be at least 6 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-200">
              Confirm Password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium py-2.5 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
