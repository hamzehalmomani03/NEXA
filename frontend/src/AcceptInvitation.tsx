
import { useState } from 'react';
import {
  Link,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type InvitationResponse = {
  success?: boolean;
  message?: string | string[];
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    isSystemAdmin: boolean;
  };
  organization?: {
    id: string;
    name: string;
    slug?: string;
    role?: string;
  };
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  marginTop: 6,
  marginBottom: 15,
  border: '1px solid #31594c',
  borderRadius: 10,
  outlineColor: '#34d399',
  background: '#091713',
  color: '#ffffff',
  fontSize: 14,
} as const;

const primaryButtonStyle = {
  width: '100%',
  padding: '14px 18px',
  background: '#34d399',
  color: '#052e24',
  border: 'none',
  borderRadius: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 15,
} as const;

function getErrorMessage(
  data: InvitationResponse,
  fallback: string,
): string {
  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }

  return data.message || fallback;
}

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (en: string, ar: string) =>
    isArabic ? ar : en;

  const invitationToken =
    searchParams.get('token') ?? '';

  const validToken =
    /^[a-f0-9]{64}$/i.test(invitationToken);

  const accessToken =
    localStorage.getItem('nexa_token');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    if (!validToken || !accessToken || loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/organizations/invitations/accept`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: invitationToken,
          }),
        },
      );

      const data: InvitationResponse =
        await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          getErrorMessage(
            data,
            'Unable to accept invitation.',
          ),
        );
      }

      if (!data.organization?.id) {
        throw new Error(
          'The server did not return the organization.',
        );
      }

      localStorage.setItem(
        'nexa_organization',
        JSON.stringify(data.organization),
      );

      navigate('/overview', {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!validToken || loading) return;

    setError('');

    if (password !== confirmPassword) {
      setError(
        t(
          'Passwords do not match.',
          'كلمتا المرور غير متطابقتين.',
        ),
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/register/invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            password,
            token: invitationToken,
          }),
        },
      );

      const data: InvitationResponse =
        await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          getErrorMessage(
            data,
            'Unable to create employee account.',
          ),
        );
      }

      if (
        !data.accessToken ||
        !data.user ||
        !data.organization?.id
      ) {
        throw new Error(
          'The server returned incomplete account information.',
        );
      }

      // Use the same storage keys as NEXA Login.
      localStorage.setItem(
        'nexa_token',
        data.accessToken,
      );

      localStorage.setItem(
        'nexa_user',
        JSON.stringify(data.user),
      );

      localStorage.setItem(
        'nexa_organization',
        JSON.stringify(data.organization),
      );

      navigate('/overview', {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: '#06110e',
        color: '#f1f5f9',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 470,
          background: '#10221d',
          border: '1px solid #25483a',
          borderRadius: 24,
          padding: 32,
          boxSizing: 'border-box',
          boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <img
            src="/nexa-icon.png"
            alt="NEXA"
            referrerPolicy="no-referrer"
            style={{
              width: 78,
              height: 78,
              borderRadius: 19,
              objectFit: 'cover',
            }}
          />

          <h1
            style={{
              margin: '12px 0 8px',
              color: '#34d399',
              fontSize: 30,
            }}
          >
            NEXA
          </h1>

          <h2
            style={{
              fontSize: 22,
              margin: '8px 0',
            }}
          >
            {t(
              'Organization Invitation',
              'دعوة للانضمام إلى مؤسسة',
            )}
          </h2>

          <p
            style={{
              color: '#a7bcb2',
              lineHeight: 1.8,
              fontSize: 14,
            }}
          >
            {t(
              'Join your team and start working with NEXA.',
              'انضم إلى فريقك وابدأ العمل باستخدام NEXA.',
            )}
          </p>
        </div>

        {!validToken ? (
          <p
            role="alert"
            style={{
              color: '#fca5a5',
              textAlign: 'center',
            }}
          >
            {t(
              'Invalid invitation link.',
              'رابط الدعوة غير صالح.',
            )}
          </p>
        ) : accessToken ? (
          <div>
            <p
              style={{
                color: '#cbd5e1',
                lineHeight: 1.8,
                textAlign: 'center',
              }}
            >
              {t(
                'You are signed in. Accept this invitation to join the organization.',
                'أنت مسجل الدخول. اقبل الدعوة للانضمام إلى المؤسسة.',
              )}
            </p>

            {error && (
              <p
                role="alert"
                style={{
                  color: '#fca5a5',
                  overflowWrap: 'anywhere',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={loading}
              style={primaryButtonStyle}
            >
              {loading
                ? t(
                    'Processing...',
                    'جارٍ المعالجة...',
                  )
                : t(
                    'Accept Invitation',
                    'قبول الدعوة',
                  )}
            </button>

            <p
              style={{
                color: '#94a3b8',
                fontSize: 12,
                textAlign: 'center',
                marginTop: 15,
              }}
            >
              {t(
                'Make sure you are signed in using the invited email address.',
                'تأكد أنك مسجل الدخول بالإيميل الذي وصلته الدعوة.',
              )}
            </p>
          </div>
        ) : (
          <>
            <h3
              style={{
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              {t(
                'Create Employee Account',
                'إنشاء حساب موظف',
              )}
            </h3>

            <form onSubmit={(event) => void handleRegister(event)}>
              <label htmlFor="invite-first-name">
                {t('First Name', 'الاسم الأول')}
              </label>

              <input
                id="invite-first-name"
                type="text"
                required
                minLength={2}
                maxLength={50}
                autoComplete="given-name"
                value={firstName}
                onChange={(event) =>
                  setFirstName(event.target.value)
                }
                style={inputStyle}
              />

              <label htmlFor="invite-last-name">
                {t('Last Name', 'اسم العائلة')}
              </label>

              <input
                id="invite-last-name"
                type="text"
                required
                minLength={2}
                maxLength={50}
                autoComplete="family-name"
                value={lastName}
                onChange={(event) =>
                  setLastName(event.target.value)
                }
                style={inputStyle}
              />

              <label htmlFor="invite-register-email">
                {t(
                  'Invited Email',
                  'الإيميل المدعو',
                )}
              </label>

              <input
                id="invite-register-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="employee@example.com"
                style={inputStyle}
              />

              <label htmlFor="invite-register-password">
                {t('Password', 'كلمة المرور')}
              </label>

              <input
                id="invite-register-password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                style={inputStyle}
              />

              <label htmlFor="invite-confirm-password">
                {t(
                  'Confirm Password',
                  'تأكيد كلمة المرور',
                )}
              </label>

              <input
                id="invite-confirm-password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                style={inputStyle}
              />

              {error && (
                <p
                  role="alert"
                  style={{
                    color: '#fca5a5',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...primaryButtonStyle,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading
                  ? t(
                      'Creating account...',
                      'جارٍ إنشاء الحساب...',
                    )
                  : t(
                      'Create Account & Join',
                      'إنشاء الحساب والانضمام',
                    )}
              </button>
            </form>

            <div
              style={{
                marginTop: 25,
                paddingTop: 20,
                borderTop: '1px solid #25483a',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                }}
              >
                {t(
                  'Already have a NEXA account?',
                  'عندك حساب NEXA من قبل؟',
                )}
              </p>

              <Link
                to="/login"
                style={{
                  color: '#34d399',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                {t(
                  'Sign In',
                  'تسجيل الدخول',
                )}
              </Link>

              <p
                style={{
                  color: '#94a3b8',
                  fontSize: 12,
                  lineHeight: 1.8,
                  marginTop: 12,
                }}
              >
                {t(
                  'After signing in, open the invitation link again.',
                  'بعد تسجيل الدخول، افتح رابط الدعوة مرة ثانية.',
                )}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
