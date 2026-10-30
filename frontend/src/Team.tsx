
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';
import TeamMemberActions from './TeamMemberActions';
import './Team.css';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type TeamRole =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Accountant'
  | 'Employee';

type TeamStatus = 'Active' | 'Invited' | 'Inactive';

type InviteRole = 'MANAGER' | 'ACCOUNTANT' | 'SALES';

type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  status: TeamStatus;
  joined: string;
};

type ApiMember = {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

type OrganizationResponse = {
  success: boolean;
  organization: {
    id: string;
    role: string;
    members: ApiMember[];
  };
};

type ApiInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
};

type InvitationsResponse = {
  success: boolean;
  invitations: ApiInvitation[];
};

type ApiErrorResponse = {
  message?: string | string[];
  error?: string;
};

const avatarColors = [
  '#174d3d',
  '#34305f',
  '#654027',
  '#23465d',
  '#63344e',
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function mapRole(role: string): TeamRole {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    case 'MANAGER':
      return 'Manager';
    case 'ACCOUNTANT':
      return 'Accountant';
    case 'SALES':
      return 'Employee';
    default:
      return 'Employee';
  }
}

function mapStatus(status: string): TeamStatus {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'INVITED':
      return 'Invited';
    case 'INACTIVE':
      return 'Inactive';
    default:
      return 'Inactive';
  }
}

function formatJoinedDate(
  date: string,
  isArabic: boolean,
): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    isArabic ? 'ar-JO' : 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    },
  ).format(parsedDate);
}

function mapApiMember(
  member: ApiMember,
  isArabic: boolean,
): TeamMember {
  const fullName = [
    member.user.firstName,
    member.user.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: member.id,
    userId: member.user.id,
    name: fullName || member.user.email,
    email: member.user.email,
    role: mapRole(member.role),
    status: mapStatus(member.status),
    joined: formatJoinedDate(
      member.joinedAt,
      isArabic,
    ),
  };
}

function getOrganizationId(): string {
  const savedOrganization = localStorage.getItem(
    'nexa_organization',
  );

  if (!savedOrganization) {
    throw new Error(
      'No organization selected. Please sign in again.',
    );
  }

  try {
    const organization = JSON.parse(
      savedOrganization,
    ) as {
      id?: string;
    };

    if (!organization.id) {
      throw new Error(
        'Selected organization is invalid. Please sign in again.',
      );
    }

    return organization.id;
  } catch {
    throw new Error(
      'Selected organization is invalid. Please sign in again.',
    );
  }
}

function getAccessToken(): string {
  const token = localStorage.getItem('nexa_token');

  if (!token) {
    throw new Error(
      'Your session has expired. Please sign in again.',
    );
  }

  return token;
}

function getApiError(
  data: ApiErrorResponse,
  status: number,
): string {
  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }

  return (
    data.message ||
    data.error ||
    `Request failed (${status})`
  );
}

async function fetchOrganization(
  organizationId: string,
): Promise<OrganizationResponse['organization']> {
  const token = getAccessToken();

  const response = await fetch(
    `${API_URL}/organizations/${encodeURIComponent(
      organizationId,
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getApiError(
        data as ApiErrorResponse,
        response.status,
      ),
    );
  }

  const result = data as OrganizationResponse;

  if (
    !result.success ||
    !result.organization ||
    !Array.isArray(result.organization.members)
  ) {
    throw new Error(
      'The server returned an unexpected organization response.',
    );
  }

  return result.organization;
}

async function fetchInvitations(
  organizationId: string,
): Promise<ApiInvitation[]> {
  const token = getAccessToken();

  const response = await fetch(
    `${API_URL}/organizations/${encodeURIComponent(
      organizationId,
    )}/invitations`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getApiError(
        data as ApiErrorResponse,
        response.status,
      ),
    );
  }

  const result = data as InvitationsResponse;

  if (
    !result.success ||
    !Array.isArray(result.invitations)
  ) {
    throw new Error(
      'The server returned an unexpected invitations response.',
    );
  }

  return result.invitations;
}

export default function Team() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  // Team members
  const [activeMembers, setMembers] = useState<
    TeamMember[]
  >([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(
    'All roles',
  );
  const [statusFilter, setStatusFilter] = useState(
    'All statuses',
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Organization permissions
  const [
    canManageInvitations,
    setCanManageInvitations,
  ] = useState(false);

  const [viewerRole, setViewerRole] = useState('');

  // Invitation list
  const [invitations, setInvitations] = useState<
    ApiInvitation[]
  >([]);

  const [
    invitationLoadError,
    setInvitationLoadError,
  ] = useState('');

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] =
    useState<InviteRole>('SALES');

  const [inviteSending, setInviteSending] =
    useState(false);

  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] =
    useState('');

  // Load organization members and invitations
  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setInvitationLoadError('');

    try {
      const organizationId = getOrganizationId();

      const organization = await fetchOrganization(
        organizationId,
      );

      setMembers(
        organization.members.map((member) =>
          mapApiMember(member, isArabic),
        ),
      );

      const canManage =
        organization.role === 'OWNER' ||
        organization.role === 'ADMIN';

      setViewerRole(organization.role);
      setCanManageInvitations(canManage);

      // Invitation management is restricted
      // to organization OWNER and ADMIN.
      if (canManage) {
        try {
          const invitationRecords =
            await fetchInvitations(organizationId);

          setInvitations(invitationRecords);
        } catch (error) {
          setInvitations([]);

          setInvitationLoadError(
            error instanceof Error
              ? error.message
              : 'Failed to load invitations.',
          );
        }
      } else {
        setInvitations([]);
      }
    } catch (error) {
      setViewerRole('');
      setCanManageInvitations(false);
      setInvitations([]);

      setLoadError(
        error instanceof Error
          ? error.message
          : isArabic
            ? 'تعذّر تحميل أعضاء الفريق.'
            : 'Failed to load team members.',
      );
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Close invite modal with Escape
  useEffect(() => {
    if (!inviteOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !inviteSending) {
        setInviteOpen(false);
      }
    }

    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [inviteOpen, inviteSending]);

  function openInviteModal() {
    if (!canManageInvitations) return;

    setInviteError('');
    setInviteSuccess('');
    setInviteEmail('');
    setInviteRole('SALES');
    setInviteOpen(true);
  }

  function closeInviteModal() {
    if (inviteSending) return;

    setInviteOpen(false);
    setInviteError('');
  }

  async function handleInvite() {
    if (inviteSending || !canManageInvitations) {
      return;
    }

    setInviteSending(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const organizationId = getOrganizationId();
      const token = getAccessToken();

      const email = inviteEmail
        .trim()
        .toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      ) {
        throw new Error(
          t(
            'Please enter a valid email address.',
            'يرجى إدخال بريد إلكتروني صحيح.',
          ),
        );
      }

      const response = await fetch(
        `${API_URL}/organizations/${encodeURIComponent(
          organizationId,
        )}/invitations`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            role: inviteRole,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          getApiError(
            data as ApiErrorResponse,
            response.status,
          ),
        );
      }

      setInviteSuccess(
        t(
          `Invitation sent successfully to ${email}`,
          `تم إرسال الدعوة بنجاح إلى ${email}`,
        ),
      );

      setInviteEmail('');
      setInviteRole('SALES');
      setInviteOpen(false);

      // Refresh members and pending invitations.
      void loadMembers();
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to send invitation.',
              'تعذّر إرسال الدعوة.',
            ),
      );
    } finally {
      setInviteSending(false);
    }
  }

  const activeCount = activeMembers.filter(
    (member) => member.status === 'Active',
  ).length;

  // Pending invitations live in the separate
  // OrganizationInvitation database table.
  const pendingInvitations = invitations.filter(
    (invitation) =>
      invitation.status === 'PENDING' &&
      new Date(invitation.expiresAt).getTime() >
        Date.now(),
  );

  // Avoid counting the same email twice
  // if an old INVITED membership also exists.
  const invitedEmails = new Set([
    ...activeMembers
      .filter((member) => member.status === 'Invited')
      .map((member) => member.email.toLowerCase()),

    ...pendingInvitations.map((invitation) =>
      invitation.email.toLowerCase(),
    ),
  ]);

  const invitedCount = invitedEmails.size;

  const adminCount = activeMembers.filter(
    (member) =>
      member.role === 'Owner' ||
      member.role === 'Admin',
  ).length;

  const filteredMembers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return activeMembers.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === 'All roles' ||
        member.role === roleFilter;

      const matchesStatus =
        statusFilter === 'All statuses' ||
        member.status === statusFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    activeMembers,
    search,
    roleFilter,
    statusFilter,
  ]);

  function translateRole(role: TeamRole) {
    const labels: Record<TeamRole, string> = {
      Owner: t('Owner', 'المالك'),
      Admin: t('Admin', 'مسؤول'),
      Manager: t('Manager', 'مدير'),
      Accountant: t('Accountant', 'محاسب'),
      Employee: t('Employee', 'موظف'),
    };

    return labels[role];
  }

  function translateStatus(status: TeamStatus) {
    const labels: Record<TeamStatus, string> = {
      Active: t('Active', 'نشط'),
      Invited: t('Invited', 'بانتظار الدعوة'),
      Inactive: t('Inactive', 'غير نشط'),
    };

    return labels[status];
  }

  function clearFilters() {
    setSearch('');
    setRoleFilter('All roles');
    setStatusFilter('All statuses');
  }

  return (
    <div
      className="team-page"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <header className="team-header">
        <div>
          <div className="team-eyebrow">
            <span className="team-eyebrow-dot" />
            {t('MANAGEMENT', 'إدارة الفريق')}
          </div>

          <h1>
            {t('Team Members', 'أعضاء الفريق')}
          </h1>

          <p className="team-subtitle">
            {t(
              'Manage your people, roles, and access to your workspace.',
              'أدر أعضاء فريقك وصلاحياتهم وإمكانية وصولهم إلى مساحة العمل.',
            )}
          </p>
        </div>

        <button
          className="team-primary-btn"
          type="button"
          onClick={openInviteModal}
          disabled={
            loading ||
            !canManageInvitations
          }
          title={
            canManageInvitations
              ? t(
                  'Invite an employee',
                  'دعوة موظف',
                )
              : t(
                  'Only organization owners and admins can invite employees.',
                  'يمكن لمالك المؤسسة أو المسؤول فقط دعوة الموظفين.',
                )
          }
        >
          <span className="team-plus">+</span>
          {t(
            'Add team member',
            'إضافة عضو للفريق',
          )}
        </button>
      </header>

      {/* SUCCESS MESSAGE */}
      {inviteSuccess && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 12,
            background: '#103c2c',
            border: '1px solid #276749',
            color: '#86efac',
          }}
        >
          ✓ {inviteSuccess}
        </div>
      )}

      {/* INVITE EMPLOYEE MODAL */}
      {inviteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeInviteModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            aria-describedby="invite-dialog-description"
            style={{
              width: '100%',
              maxWidth: 470,
              boxSizing: 'border-box',
              padding: 30,
              borderRadius: 22,
              background: '#10221d',
              border: '1px solid #285344',
              color: '#ffffff',
              boxShadow:
                '0 24px 70px rgba(0,0,0,0.55)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 18,
              }}
            >
              <img
                src="/nexa-icon.png"
                alt=""
                aria-hidden="true"
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 14,
                  objectFit: 'cover',
                }}
              />

              <div>
                <h2
                  id="invite-dialog-title"
                  style={{
                    color: '#34d399',
                    margin: 0,
                  }}
                >
                  {t(
                    'Invite Employee',
                    'دعوة موظف',
                  )}
                </h2>

                <span
                  style={{
                    fontSize: 12,
                    color: '#91a99e',
                  }}
                >
                  NEXA Workspace
                </span>
              </div>
            </div>

            <p
              id="invite-dialog-description"
              style={{
                color: '#a7bcb2',
                lineHeight: 1.8,
              }}
            >
              {t(
                'Enter the employee email and choose their role. NEXA will send a secure invitation link.',
                'أدخل بريد الموظف واختر صلاحياته. سيقوم NEXA بإرسال رابط دعوة آمن.',
              )}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleInvite();
              }}
            >
              <label
                htmlFor="invite-email"
                style={{
                  display: 'block',
                  marginBottom: 9,
                  fontWeight: 600,
                }}
              >
                {t(
                  'Employee Email',
                  'البريد الإلكتروني للموظف',
                )}
              </label>

              <input
                id="invite-email"
                type="email"
                required
                maxLength={254}
                autoFocus
                autoComplete="email"
                disabled={inviteSending}
                value={inviteEmail}
                onChange={(event) =>
                  setInviteEmail(
                    event.target.value,
                  )
                }
                placeholder="employee@example.com"
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  padding: 14,
                  marginBottom: 22,
                  borderRadius: 11,
                  border: '1px solid #335c4e',
                  background: '#091713',
                  color: '#ffffff',
                  fontSize: 15,
                  outlineColor: '#34d399',
                }}
              />

              <label
                htmlFor="invite-role"
                style={{
                  display: 'block',
                  marginBottom: 9,
                  fontWeight: 600,
                }}
              >
                {t(
                  'Employee Role',
                  'صلاحية الموظف',
                )}
              </label>

              <select
                id="invite-role"
                disabled={inviteSending}
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(
                    event.target.value as InviteRole,
                  )
                }
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  padding: 14,
                  marginBottom: 20,
                  borderRadius: 11,
                  border: '1px solid #335c4e',
                  background: '#091713',
                  color: '#ffffff',
                  fontSize: 15,
                }}
              >
                <option value="SALES">
                  {t(
                    'Sales Employee',
                    'موظف مبيعات',
                  )}
                </option>

                <option value="ACCOUNTANT">
                  {t(
                    'Accountant',
                    'محاسب',
                  )}
                </option>

                <option value="MANAGER">
                  {t(
                    'Manager',
                    'مدير',
                  )}
                </option>
              </select>

              <p
                style={{
                  color: '#91a99e',
                  fontSize: 12,
                  marginTop: -4,
                  marginBottom: 20,
                }}
              >
                {t(
                  'The invitation expires after 7 days.',
                  'تنتهي صلاحية الدعوة بعد 7 أيام.',
                )}
              </p>

              {inviteError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 18,
                    padding: 12,
                    borderRadius: 9,
                    background: '#421b24',
                    color: '#fca5a5',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {inviteError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  disabled={inviteSending}
                  onClick={closeInviteModal}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 10,
                    background: '#253c34',
                    border: 0,
                    color: '#ffffff',
                    cursor: inviteSending
                      ? 'not-allowed'
                      : 'pointer',
                  }}
                >
                  {t('Cancel', 'إلغاء')}
                </button>

                <button
                  type="submit"
                  disabled={inviteSending}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 10,
                    background: '#34d399',
                    color: '#052e24',
                    fontWeight: 700,
                    border: 0,
                    cursor: inviteSending
                      ? 'wait'
                      : 'pointer',
                    opacity: inviteSending
                      ? 0.65
                      : 1,
                  }}
                >
                  {inviteSending
                    ? t(
                        'Sending...',
                        'جارٍ الإرسال...',
                      )
                    : t(
                        'Send Invitation',
                        'إرسال الدعوة',
                      )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MEMBERS LOAD ERROR */}
      {loadError && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: 16,
            border: '1px solid #efb4b4',
            borderRadius: 12,
            color: '#a12626',
            background: '#fff5f5',
          }}
        >
          <p
            style={{
              marginTop: 0,
              marginBottom: 12,
            }}
          >
            {t(
              'Could not load team members:',
              'تعذّر تحميل أعضاء الفريق:',
            )}{' '}
            {loadError}
          </p>

          <button
            type="button"
            className="team-secondary-btn"
            onClick={() => void loadMembers()}
          >
            {t('Try again', 'إعادة المحاولة')}
          </button>
        </div>
      )}

      {/* INVITATIONS LOAD ERROR */}
      {invitationLoadError &&
        canManageInvitations && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 12,
              border: '1px solid #a76b36',
              color: '#fbbf24',
              background: '#32291c',
            }}
          >
            {t(
              'Could not load invitations:',
              'تعذّر تحميل الدعوات:',
            )}{' '}
            {invitationLoadError}

            <button
              className="team-secondary-btn"
              type="button"
              onClick={() => void loadMembers()}
              style={{
                marginInlineStart: 12,
              }}
            >
              {t('Retry', 'إعادة المحاولة')}
            </button>
          </div>
        )}

      {/* TEAM STATISTICS */}
      <section className="team-stats">
        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>
              {t(
                'Total members',
                'إجمالي الأعضاء',
              )}
            </span>
            <span className="team-stat-icon">
              ♧
            </span>
          </div>

          <div className="team-stat-value">
            {loading
              ? '...'
              : activeMembers.length.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}
          </div>

          <div className="team-stat-note">
            {t(
              'People in your workspace',
              'الأشخاص في مساحة العمل',
            )}
          </div>
        </article>

        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>
              {t(
                'Active members',
                'الأعضاء النشطون',
              )}
            </span>

            <span className="team-stat-icon team-icon-green">
              ✓
            </span>
          </div>

          <div className="team-stat-value">
            {loading
              ? '...'
              : activeCount.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}
          </div>

          <div className="team-stat-note">
            <span className="team-status-dot active-dot" />
            {t(
              'Currently active',
              'نشطون حاليًا',
            )}
          </div>
        </article>

        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>
              {t(
                'Pending invites',
                'الدعوات المعلّقة',
              )}
            </span>

            <span className="team-stat-icon team-icon-yellow">
              ✉
            </span>
          </div>

          <div className="team-stat-value">
            {loading
              ? '...'
              : invitedCount.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}
          </div>

          <div className="team-stat-note">
            {t(
              'Waiting to join',
              'بانتظار الانضمام',
            )}
          </div>
        </article>

        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>
              {t(
                'Admins & owners',
                'المسؤولون والمُلّاك',
              )}
            </span>

            <span className="team-stat-icon team-icon-purple">
              ♙
            </span>
          </div>

          <div className="team-stat-value">
            {loading
              ? '...'
              : adminCount.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}
          </div>

          <div className="team-stat-note">
            {t(
              'Elevated access roles',
              'صلاحيات وصول متقدمة',
            )}
          </div>
        </article>
      </section>

      {/* MEMBERS TABLE */}
      <section className="team-table-card">
        <div className="team-table-heading">
          <div>
            <h2>
              {t(
                'All members',
                'جميع الأعضاء',
              )}
            </h2>

            <p>
              {t(
                'View and manage everyone in your team.',
                'استعرض جميع أعضاء فريقك وأدر بياناتهم.',
              )}
            </p>
          </div>

          <span className="team-count-badge">
            {loading
              ? '...'
              : filteredMembers.length.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}{' '}
            {t('members', 'أعضاء')}
          </span>
        </div>

        <div className="team-toolbar">
          <div className="team-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              placeholder={t(
                'Search name or email...',
                'ابحث بالاسم أو البريد الإلكتروني...',
              )}
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              aria-label={t(
                'Search team members',
                'البحث عن أعضاء الفريق',
              )}
            />
          </div>

          <select
            className="team-filter"
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value)
            }
            aria-label={t(
              'Filter by role',
              'تصفية حسب الدور',
            )}
          >
            <option value="All roles">
              {t('All roles', 'جميع الأدوار')}
            </option>

            <option value="Owner">
              {t('Owner', 'المالك')}
            </option>

            <option value="Admin">
              {t('Admin', 'مسؤول')}
            </option>

            <option value="Manager">
              {t('Manager', 'مدير')}
            </option>

            <option value="Accountant">
              {t('Accountant', 'محاسب')}
            </option>

            <option value="Employee">
              {t('Employee', 'موظف')}
            </option>
          </select>

          <select
            className="team-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            aria-label={t(
              'Filter by status',
              'تصفية حسب الحالة',
            )}
          >
            <option value="All statuses">
              {t(
                'All statuses',
                'جميع الحالات',
              )}
            </option>

            <option value="Active">
              {t('Active', 'نشط')}
            </option>

            <option value="Invited">
              {t(
                'Invited',
                'بانتظار الدعوة',
              )}
            </option>

            <option value="Inactive">
              {t('Inactive', 'غير نشط')}
            </option>
          </select>
        </div>

        <div className="team-table-wrap">
          <table className="team-table">
            <thead>
              <tr>
                <th>
                  {t('MEMBER', 'العضو')}
                </th>

                <th>
                  {t('ROLE', 'الدور')}
                </th>

                <th>
                  {t('STATUS', 'الحالة')}
                </th>

                <th>
                  {t('JOINED', 'تاريخ الانضمام')}
                </th>

                <th className="team-actions-heading">
                  {t(
                    'ACTIONS',
                    'الإجراءات',
                  )}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="team-empty-state">
                      <strong>
                        {t(
                          'Loading team members...',
                          'جارٍ تحميل أعضاء الفريق...',
                        )}
                      </strong>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                !loadError &&
                filteredMembers.map(
                  (member, index) => (
                    <tr key={member.id}>
                      <td>
                        <div className="team-member-cell">
                          <div
                            className="team-avatar"
                            style={{
                              background:
                                avatarColors[
                                  index %
                                    avatarColors.length
                                ],
                            }}
                          >
                            {getInitials(
                              member.name,
                            )}
                          </div>

                          <div className="team-member-info">
                            <span className="team-member-name">
                              {member.name}
                            </span>

                            <span className="team-member-email">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`team-role role-${member.role.toLowerCase()}`}
                        >
                          {member.role ===
                            'Owner' && (
                            <span>♛ </span>
                          )}

                          {translateRole(
                            member.role,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`team-status status-${member.status.toLowerCase()}`}
                        >
                          <span className="team-status-dot" />

                          {translateStatus(
                            member.status,
                          )}
                        </span>
                      </td>

                      <td className="team-joined">
                        {member.joined}
                      </td>

                      <td className="team-actions-cell">
                        <TeamMemberActions
                          member={member}
                          viewerRole={viewerRole}
                          onUpdated={() => {
                            void loadMembers();
                          }}
                          onSuccess={setInviteSuccess}
                          t={t}
                        />
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
                !loadError &&
                filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="team-empty-state">
                        <span>⌕</span>

                        <strong>
                          {t(
                            'No members found',
                            'لم يتم العثور على أعضاء',
                          )}
                        </strong>

                        <p>
                          {t(
                            'Try changing your search or filters.',
                            'جرّب تعديل كلمات البحث أو خيارات التصفية.',
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={clearFilters}
                        >
                          {t(
                            'Clear filters',
                            'مسح عوامل التصفية',
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="team-table-footer">
          <span>
            {t('Showing', 'عرض')}{' '}
            {loading
              ? '...'
              : filteredMembers.length.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}{' '}
            {t('of', 'من')}{' '}
            {loading
              ? '...'
              : activeMembers.length.toLocaleString(
                  isArabic
                    ? 'ar-JO'
                    : 'en-US',
                )}{' '}
            {t('members', 'أعضاء')}
          </span>

          <span className="team-footer-indicator">
            <span className="team-status-dot active-dot" />
            {t(
              'Workspace members',
              'أعضاء مساحة العمل',
            )}
          </span>
        </div>
      </section>

      {/* PENDING INVITATIONS */}
      {canManageInvitations && (
        <section
          className="team-table-card"
          style={{ marginTop: 24 }}
        >
          <div className="team-table-heading">
            <div>
              <h2>
                {t(
                  'Pending Invitations',
                  'الدعوات المعلّقة',
                )}
              </h2>

              <p>
                {t(
                  'Employees who received an invitation and have not joined yet.',
                  'الموظفون الذين أُرسلت لهم دعوات ولم ينضموا بعد.',
                )}
              </p>
            </div>

            <span className="team-count-badge">
              {pendingInvitations.length}{' '}
              {t(
                'invitations',
                'دعوات',
              )}
            </span>
          </div>

          <div className="team-table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th>
                    {t('EMAIL', 'الإيميل')}
                  </th>

                  <th>
                    {t('ROLE', 'الدور')}
                  </th>

                  <th>
                    {t('STATUS', 'الحالة')}
                  </th>

                  <th>
                    {t(
                      'EXPIRES',
                      'تاريخ الانتهاء',
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {pendingInvitations.length ===
                0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="team-empty-state">
                        <strong>
                          {t(
                            'No pending invitations',
                            'لا توجد دعوات معلّقة',
                          )}
                        </strong>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pendingInvitations.map(
                    (invitation) => (
                      <tr key={invitation.id}>
                        <td>
                          <span className="team-member-email">
                            {invitation.email}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`team-role role-${mapRole(
                              invitation.role,
                            ).toLowerCase()}`}
                          >
                            {translateRole(
                              mapRole(
                                invitation.role,
                              ),
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="team-status status-invited">
                            <span className="team-status-dot" />

                            {t(
                              'Pending',
                              'بانتظار القبول',
                            )}
                          </span>
                        </td>

                        <td className="team-joined">
                          {formatJoinedDate(
                            invitation.expiresAt,
                            isArabic,
                          )}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* INFO BANNER */}
      <aside className="team-info-banner">
        <div className="team-info-icon">
          ✳
        </div>

        <div>
          <h3>
            {t(
              'Great teams build great businesses',
              'الفرق المتميزة تبني أعمالًا ناجحة',
            )}
          </h3>

          <p>
            {t(
              'Assign the right roles and keep your workspace organized as your business grows.',
              'امنح كل عضو الصلاحيات المناسبة وحافظ على تنظيم مساحة العمل مع نمو أعمالك.',
            )}
          </p>
        </div>

        <span className="team-banner-decoration">
          NEXA
        </span>
      </aside>
    </div>
  );
}

