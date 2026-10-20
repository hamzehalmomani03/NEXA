
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('This password reset link is missing its token.');
      return;
    }

    if (password.length < 12) {
      setError('Your password must be at least 12 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL.replace(/\/+$/, '')}/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            newPassword: password,
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string | string[];
      };

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;

        throw new Error(
          message || 'Unable to reset your password. The link may have expired.',
        );
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">N</div>
          <span>NEXA</span>
        </div>

        <div className="login-heading">
          <p className="login-eyebrow">ACCOUNT SECURITY</p>
          <h1>Reset your password</h1>
          <p>
            Choose a new password for your NEXA account.
          </p>
        </div>

        {success ? (
          <div className="login-form">
            <div className="login-success" role="status">
              Your password has been reset successfully.
            </div>

            <Link to="/login" className="primary-button">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              required
              autoFocus
            />

            <label htmlFor="confirmPassword">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Enter the password again"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              minLength={12}
              required
            />

            <p className="login-hint">
              Use at least 12 characters.
            </p>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !token}>
              {loading ? 'Resetting password...' : 'Reset password'}
            </button>

            <Link to="/login" className="login-secondary-button">
              Back to sign in
            </Link>
          </form>
        )}

        <p className="login-footer">
          Secure access to your business workspace.
        </p>
      </section>
    </main>
  );
}