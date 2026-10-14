
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthResponse {
  success?: boolean;
  accessToken?: string;
  requiresTwoFactor?: boolean;
  challengeToken?: string;
  message?: string | string[];
  user?: AuthUser;
  organization?: Organization;
}

interface OrganizationsResponse {
  success?: boolean;
  organizations?: Organization[];
  message?: string | string[];
}

type AuthMode = 'login' | 'register';

function getErrorMessage(
  data: { message?: string | string[] },
  fallback: string,
): string {
  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }

  return data.message || fallback;
}

async function readResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      `The server returned an invalid response (${response.status}).`,
    );
  }
}

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Two-factor login state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setSuccessMessage('');
    setRequiresTwoFactor(false);
    setChallengeToken('');
    setVerificationCode('');
    setPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError('');
    setSuccessMessage('');
    setLoading(true);

    const isRegister = mode === 'register';

    try {
      const endpoint = isRegister
        ? `${API_URL}/auth/register`
        : `${API_URL}/auth/login`;

      const body = isRegister
        ? {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            password,
            organizationName: organizationName.trim(),
          }
        : {
            email: email.trim().toLowerCase(),
            password,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await readResponse<AuthResponse>(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            isRegister
              ? 'Account creation failed. Please try again.'
              : 'Login failed. Check your email and password.',
          ),
        );
      }

      // Password accepted, but a second factor is required.
      // Do not save a session or navigate yet.
      if (data.requiresTwoFactor && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setRequiresTwoFactor(true);
        setPassword('');
        setVerificationCode('');
        setSuccessMessage(
          'Password verified. Enter the code from your authenticator app.',
        );
        return;
      }

      if (!data.accessToken || !data.user) {
        if (isRegister) {
          setMode('login');
          setPassword('');
          setSuccessMessage(
            'Account created successfully. Please sign in.',
          );
          return;
        }

        throw new Error(
          'The server did not return an access token or user.',
        );
      }

      await finishLogin(data.accessToken, data.user);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTwoFactor(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading || !challengeToken) return;

    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login/2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challengeToken,
          code: verificationCode.trim(),
        }),
      });

      const data = await readResponse<AuthResponse>(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, 'Invalid or expired verification code.'),
        );
      }

      if (!data.accessToken || !data.user) {
        throw new Error(
          'Verification succeeded without a complete login response.',
        );
      }

      // Clear the temporary challenge before completing login.
      setChallengeToken('');
      setRequiresTwoFactor(false);
      setVerificationCode('');

      await finishLogin(data.accessToken, data.user);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Verification failed. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function finishLogin(token: string, user: AuthUser) {
    const organizationsUrl = `${API_URL}/organizations/my`;

    const organizationsResponse = await fetch(organizationsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const organizationsData =
      await readResponse<OrganizationsResponse>(organizationsResponse);

    if (!organizationsResponse.ok) {
      throw new Error(
        getErrorMessage(
          organizationsData,
          'Login succeeded, but organizations could not be loaded.',
        ),
      );
    }

    const organizations = organizationsData.organizations;

    if (!organizations || organizations.length === 0) {
      throw new Error(
        'Your account has no organization yet. Create or join an organization before continuing.',
      );
    }

    let previousOrganizationId: string | null = null;

    try {
      const savedOrganization = localStorage.getItem(
        'nexa_organization',
      );

      if (savedOrganization) {
        const parsed = JSON.parse(
          savedOrganization,
        ) as Partial<Organization>;

        if (typeof parsed.id === 'string') {
          previousOrganizationId = parsed.id;
        }
      }
    } catch {
      previousOrganizationId = null;
    }

    const selectedOrganization =
      organizations.find(
        (organization) =>
          organization.id === previousOrganizationId,
      ) ?? organizations[0];

    try {
      localStorage.setItem('nexa_token', token);
      localStorage.setItem('nexa_user', JSON.stringify(user));
      localStorage.setItem(
        'nexa_organization',
        JSON.stringify(selectedOrganization),
      );
    } catch {
      throw new Error(
        'Could not save your session in this browser. Check browser storage settings.',
      );
    }

    navigate('/products', { replace: true });
  }

  const isRegister = mode === 'register';

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">N</div>
          <span>NEXA</span>
        </div>

        <div className="login-heading">
          <p className="login-eyebrow">
            {requiresTwoFactor
              ? 'TWO-FACTOR AUTHENTICATION'
              : isRegister
                ? 'GET STARTED'
                : 'WELCOME BACK'}
          </p>

          <h1>
            {requiresTwoFactor
              ? 'Verify your identity'
              : isRegister
                ? 'Create your account'
                : 'Sign in to NEXA'}
          </h1>

          <p>
            {requiresTwoFactor
              ? 'Enter the six-digit code from your authenticator app.'
              : isRegister
                ? 'Create your account and set up your workspace.'
                : 'Manage your business from one place.'}
          </p>
        </div>

        {!requiresTwoFactor ? (
          <form className="login-form" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <label htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="Enter your first name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  minLength={2}
                />

                <label htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Enter your last name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  minLength={2}
                />

                <label htmlFor="organizationName">Business name</label>
                <input
                  id="organizationName"
                  type="text"
                  placeholder="Enter your business name"
                  value={organizationName}
                  onChange={(event) =>
                    setOrganizationName(event.target.value)
                  }
                  required
                  minLength={2}
                />
              </>
            )}

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={
                isRegister ? 'Create a password' : 'Enter your password'
              }
              autoComplete={
                isRegister ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={isRegister ? 8 : undefined}
            />

            {isRegister && (
              <p className="login-hint">
                Use at least 8 characters for your password.
              </p>
            )}

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="login-success" role="status">
                {successMessage}
              </div>
            )}

            <button type="submit" disabled={loading}>
              {loading
                ? isRegister
                  ? 'Creating account...'
                  : 'Signing in...'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>
        ) : (
          <form
            className="login-form"
            onSubmit={handleVerifyTwoFactor}
          >
            <label htmlFor="verificationCode">
              Authentication code
            </label>

            <input
              id="verificationCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter your 6-digit code"
              value={verificationCode}
              onChange={(event) =>
                setVerificationCode(
                  event.target.value.replace(/\D/g, '').slice(0, 6),
                )
              }
              required
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              autoFocus
            />

            <p className="login-hint">
              Open your authenticator app and enter the current code.
            </p>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="login-success" role="status">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify and sign in'}
            </button>

            <button
              type="button"
              className="login-secondary-button"
              disabled={loading}
              onClick={() => {
                setRequiresTwoFactor(false);
                setChallengeToken('');
                setVerificationCode('');
                setPassword('');
                setError('');
                setSuccessMessage('');
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {!requiresTwoFactor && (
          <div className="login-switch">
            {isRegister ? (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => changeMode('login')}
                  disabled={loading}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                <span>Don't have an account?</span>
                <button
                  type="button"
                  onClick={() => changeMode('register')}
                  disabled={loading}
                >
                  Create account
                </button>
              </>
            )}
          </div>
        )}

        <p className="login-footer">
          Secure access to your business workspace.
        </p>
      </section>
    </main>
  );
}
