import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Team.css';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type TeamRole =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Accountant'
  | 'Employee';

type TeamStatus = 'Active' | 'Invited' | 'Inactive';

type TeamMember = {
  id: string;
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
    members: ApiMember[];
  };
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

function formatJoinedDate(date: string, isArabic: boolean): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(isArabic ? 'ar-JO' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(parsedDate);
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
    name: fullName || member.user.email,
    email: member.user.email,
    role: mapRole(member.role),
    status: mapStatus(member.status),
    joined: formatJoinedDate(member.joinedAt, isArabic),
  };
}

function getOrganizationId(): string {
  const savedOrganization = localStorage.getItem('nexa_organization');

  if (!savedOrganization) {
    throw new Error(
      'No organization selected. Please sign in again.',
    );
  }

  try {
    const organization = JSON.parse(savedOrganization) as {
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

async function fetchOrganizationMembers(
  organizationId: string,
): Promise<ApiMember[]> {
  // Login.tsx stores the JWT in localStorage.
  // A JWT is a plain string, so do not use JSON.parse on it.
  const token = localStorage.getItem('nexa_token');

  if (!token) {
    throw new Error(
      'Your session has expired. Please sign in again.',
    );
  }

  const response = await fetch(
    `${API_URL}/organizations/${encodeURIComponent(organizationId)}`,
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
    const errorData = data as {
      message?: string | string[];
      error?: string;
    };

    const message = Array.isArray(errorData.message)
      ? errorData.message.join(', ')
      : errorData.message ||
        errorData.error ||
        `Request failed (${response.status})`;

    throw new Error(message);
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

  return result.organization.members;
}

export default function Team() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const [activeMembers, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [statusFilter, setStatusFilter] = useState('All statuses');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const organizationId = getOrganizationId();
      const members = await fetchOrganizationMembers(organizationId);

      setMembers(
        members.map((member) => mapApiMember(member, isArabic)),
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to load team members.',
              'تعذّر تحميل أعضاء الفريق.',
            ),
      );
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const activeCount = activeMembers.filter(
    (member) => member.status === 'Active',
  ).length;

  const invitedCount = activeMembers.filter(
    (member) => member.status === 'Invited',
  ).length;

  const adminCount = activeMembers.filter(
    (member) =>
      member.role === 'Owner' || member.role === 'Admin',
  ).length;

  const filteredMembers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return activeMembers.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === 'All roles' || member.role === roleFilter;

      const matchesStatus =
        statusFilter === 'All statuses' ||
        member.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [activeMembers, search, roleFilter, statusFilter]);

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
    <div className="team-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="team-header">
        <div>
          <div className="team-eyebrow">
            <span className="team-eyebrow-dot" />
            {t('MANAGEMENT', 'إدارة الفريق')}
          </div>

          <h1>{t('Team Members', 'أعضاء الفريق')}</h1>

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
          disabled
          title={t(
            'Member invitations are not connected to the backend yet.',
            'لم يتم ربط دعوات الأعضاء بالخادم بعد.',
          )}
        >
          <span className="team-plus">+</span>
          {t('Add team member', 'إضافة عضو للفريق')}
        </button>
      </header>

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
          <p style={{ marginTop: 0, marginBottom: 12 }}>
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

      <section className="team-stats">
        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>{t('Total members', 'إجمالي الأعضاء')}</span>
            <span className="team-stat-icon">♧</span>
          </div>

          <div className="team-stat-value">
            {loading ? '...' : activeMembers.length.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}
          </div>

          <div className="team-stat-note">
            {t('People in your workspace', 'الأشخاص في مساحة العمل')}
          </div>
        </article>

        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>{t('Active members', 'الأعضاء النشطون')}</span>
            <span className="team-stat-icon team-icon-green">✓</span>
          </div>

          <div className="team-stat-value">
            {loading ? '...' : activeCount.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}
          </div>

          <div className="team-stat-note">
            <span className="team-status-dot active-dot" />
            {t('Currently active', 'نشطون حاليًا')}
          </div>
        </article>

        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>{t('Pending invites', 'الدعوات المعلّقة')}</span>
            <span className="team-stat-icon team-icon-yellow">✉</span>
          </div>

          <div className="team-stat-value">
            {loading ? '...' : invitedCount.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}
          </div>

          <div className="team-stat-note">
            {t('Waiting to join', 'بانتظار الانضمام')}
          </div>
        </article>

        <article className="team-stat-card">
          <div className="team-stat-top">
            <span>{t('Admins & owners', 'المسؤولون والمُلّاك')}</span>
            <span className="team-stat-icon team-icon-purple">♙</span>
          </div>

          <div className="team-stat-value">
            {loading ? '...' : adminCount.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}
          </div>

          <div className="team-stat-note">
            {t('Elevated access roles', 'صلاحيات وصول متقدمة')}
          </div>
        </article>
      </section>

      <section className="team-table-card">
        <div className="team-table-heading">
          <div>
            <h2>{t('All members', 'جميع الأعضاء')}</h2>
            <p>
              {t(
                'View and manage everyone in your team.',
                'استعرض جميع أعضاء فريقك وأدر بياناتهم.',
              )}
            </p>
          </div>

          <span className="team-count-badge">
            {loading ? '...' : filteredMembers.length.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}{' '}
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
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t(
                'Search team members',
                'البحث عن أعضاء الفريق',
              )}
            />
          </div>

          <select
            className="team-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label={t('Filter by role', 'تصفية حسب الدور')}
          >
            <option value="All roles">{t('All roles', 'جميع الأدوار')}</option>
            <option value="Owner">{t('Owner', 'المالك')}</option>
            <option value="Admin">{t('Admin', 'مسؤول')}</option>
            <option value="Manager">{t('Manager', 'مدير')}</option>
            <option value="Accountant">{t('Accountant', 'محاسب')}</option>
            <option value="Employee">{t('Employee', 'موظف')}</option>
          </select>

          <select
            className="team-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={t('Filter by status', 'تصفية حسب الحالة')}
          >
            <option value="All statuses">{t('All statuses', 'جميع الحالات')}</option>
            <option value="Active">{t('Active', 'نشط')}</option>
            <option value="Invited">{t('Invited', 'بانتظار الدعوة')}</option>
            <option value="Inactive">{t('Inactive', 'غير نشط')}</option>
          </select>
        </div>

        <div className="team-table-wrap">
          <table className="team-table">
            <thead>
              <tr>
                <th>{t('MEMBER', 'العضو')}</th>
                <th>{t('ROLE', 'الدور')}</th>
                <th>{t('STATUS', 'الحالة')}</th>
                <th>{t('JOINED', 'تاريخ الانضمام')}</th>
                <th className="team-actions-heading">{t('ACTIONS', 'الإجراءات')}</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="team-empty-state">
                      <strong>{t('Loading team members...', 'جارٍ تحميل أعضاء الفريق...')}</strong>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                !loadError &&
                filteredMembers.map((member, index) => (
                  <tr key={member.id}>
                    <td>
                      <div className="team-member-cell">
                        <div
                          className="team-avatar"
                          style={{
                            background: avatarColors[index % avatarColors.length],
                          }}
                        >
                          {getInitials(member.name)}
                        </div>

                        <div className="team-member-info">
                          <span className="team-member-name">{member.name}</span>
                          <span className="team-member-email">{member.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`team-role role-${member.role.toLowerCase()}`}>
                        {member.role === 'Owner' && <span>♛ </span>}
                        {translateRole(member.role)}
                      </span>
                    </td>

                    <td>
                      <span className={`team-status status-${member.status.toLowerCase()}`}>
                        <span className="team-status-dot" />
                        {translateStatus(member.status)}
                      </span>
                    </td>

                    <td className="team-joined">{member.joined}</td>

                    <td className="team-actions-cell">
                      <button
                        className="team-action-btn"
                        type="button"
                        disabled
                        aria-label={t(
                          `Actions for ${member.name}`,
                          `إجراءات العضو ${member.name}`,
                        )}
                        title={t(
                          'Member management is not connected yet.',
                          'إدارة الأعضاء غير مفعّلة بعد.',
                        )}
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && !loadError && filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="team-empty-state">
                      <span>⌕</span>

                      <strong>{t('No members found', 'لم يتم العثور على أعضاء')}</strong>

                      <p>
                        {t(
                          'Try changing your search or filters.',
                          'جرّب تعديل كلمات البحث أو خيارات التصفية.',
                        )}
                      </p>

                      <button type="button" onClick={clearFilters}>
                        {t('Clear filters', 'مسح عوامل التصفية')}
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
            {loading ? '...' : filteredMembers.length.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}{' '}
            {t('of', 'من')}{' '}
            {loading ? '...' : activeMembers.length.toLocaleString(isArabic ? 'ar-JO' : 'en-US')}{' '}
            {t('members', 'أعضاء')}
          </span>

          <span className="team-footer-indicator">
            <span className="team-status-dot active-dot" />
            {t('Workspace members', 'أعضاء مساحة العمل')}
          </span>
        </div>
      </section>

      <aside className="team-info-banner">
        <div className="team-info-icon">✳</div>

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

        <span className="team-banner-decoration">NEXA</span>
      </aside>
    </div>
  );
}
