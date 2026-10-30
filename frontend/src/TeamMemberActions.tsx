import { useState } from 'react';
import { createPortal } from 'react-dom';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type Role = 'Owner' | 'Admin' | 'Manager' | 'Accountant' | 'Employee';
type Status = 'Active' | 'Inactive' | 'Invited';
type EditableRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'SALES';

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
};

type Props = {
  member: Member;
  viewerRole: string;
  onUpdated: () => void;
  onSuccess: (message: string) => void;
  t: (english: string, arabic: string) => string;
};

function getToken() {
  const token = localStorage.getItem('nexa_token');

  if (!token) {
    throw new Error('Session expired. Please sign in again.');
  }

  return token;
}

function getOrganizationId() {
  const raw = localStorage.getItem('nexa_organization');

  if (!raw) {
    throw new Error('No organization selected.');
  }

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid organization selection.');
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !('id' in data) ||
    typeof data.id !== 'string' ||
    !data.id
  ) {
    throw new Error('Invalid organization selection.');
  }

  return data.id;
}

function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem('nexa_user');
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (typeof data?.id === 'string') {
      return data.id;
    }

    if (typeof data?.user?.id === 'string') {
      return data.user.id;
    }
  } catch {
    return null;
  }

  return null;
}

function toEditableRole(role: Role): EditableRole {
  switch (role) {
    case 'Admin':
      return 'ADMIN';
    case 'Manager':
      return 'MANAGER';
    case 'Accountant':
      return 'ACCOUNTANT';
    default:
      return 'SALES';
  }
}

function apiError(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = data.message;

    if (typeof message === 'string') return message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  return `Request failed (${status})`;
}

const fieldStyle = {
  display: 'block' as const,
  width: '100%',
  padding: '12px',
  boxSizing: 'border-box' as const,
  borderRadius: 10,
  background: '#091713',
  border: '1px solid #335c4e',
  color: '#fff',
  marginTop: 8,
  marginBottom: 18,
};

export default function TeamMemberActions({
  member,
  viewerRole,
  onUpdated,
  onSuccess,
  t,
}: Props) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<EditableRole>(
    toEditableRole(member.role),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = getCurrentUserId();

  const canManage =
    (viewerRole === 'OWNER' || viewerRole === 'ADMIN') &&
    member.role !== 'Owner' &&
    member.status !== 'Invited' &&
    !(viewerRole === 'ADMIN' && member.role === 'Admin') &&
    member.userId !== currentUserId;

  const availableRoles: EditableRole[] =
    viewerRole === 'OWNER'
      ? ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES']
      : ['MANAGER', 'ACCOUNTANT', 'SALES'];

  function openDialog() {
    if (!canManage) return;

    setRole(toEditableRole(member.role));
    setError('');
    setOpen(true);
  }

  async function updateMember(
    action: 'role' | 'status',
    value: EditableRole | 'ACTIVE' | 'INACTIVE',
  ) {
    if (!canManage || busy) return;

    setBusy(true);
    setError('');

    try {
      const organizationId = getOrganizationId();
      const token = getToken();

      const url =
        `${API_URL}/organizations/` +
        `${encodeURIComponent(organizationId)}/members/` +
        `${encodeURIComponent(member.id)}/${action}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [action]: value,
        }),
      });

      const data: unknown = await response
        .json()
        .catch(() => ({}));

      const success =
        data &&
        typeof data === 'object' &&
        'success' in data &&
        data.success === true;

      if (!response.ok || !success) {
        throw new Error(apiError(data, response.status));
      }

      setOpen(false);
      onUpdated();

      onSuccess(
        action === 'role'
          ? t(
              `Role updated for ${member.name}.`,
              `تم تحديث صلاحية ${member.name}.`,
            )
          : value === 'INACTIVE'
            ? t(
                `${member.name} has been disabled.`,
                `تم تعطيل عضوية ${member.name}.`,
              )
            : t(
                `${member.name} has been reactivated.`,
                `تمت إعادة تفعيل عضوية ${member.name}.`,
              ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Operation failed.', 'فشلت العملية.'),
      );
    } finally {
      setBusy(false);
    }
  }

  function handleStatusChange() {
    const deactivate = member.status === 'Active';

    if (deactivate) {
      const confirmed = window.confirm(
        t(
          `Disable ${member.name}'s access to this organization?`,
          `هل تريد تعطيل وصول ${member.name} إلى المؤسسة؟`,
        ),
      );

      if (!confirmed) return;
    }

    void updateMember(
      'status',
      deactivate ? 'INACTIVE' : 'ACTIVE',
    );
  }

  return (
    <>
      <button
        className="team-action-btn"
        type="button"
        disabled={!canManage}
        onClick={openDialog}
        aria-label={t(
          `Manage ${member.name}`,
          `إدارة العضو ${member.name}`,
        )}
        title={
          canManage
            ? t('Manage member', 'إدارة العضو')
            : t(
                'You cannot modify this member.',
                'لا يمكنك تعديل هذا العضو.',
              )
        }
      >
        ⋯
      </button>

      {open && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-management-title"
            style={{
              width: '100%',
              maxWidth: 460,
              padding: 28,
              whiteSpace: 'normal',
              boxSizing: 'border-box',
              borderRadius: 20,
              background: '#10221d',
              border: '1px solid #285344',
              color: '#fff',
              boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
            }}
          >
            <h2
              id="member-management-title"
              style={{ color: '#34d399', marginTop: 0 }}
            >
              {t('Manage Employee', 'إدارة الموظف')}
            </h2>

            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              {member.name}
            </p>

            <p
              style={{
                color: '#9fb6ab',
                marginTop: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {member.email}
            </p>

            <label htmlFor="manage-member-role" style={{ display: "block" }}>
              {t('Employee Role', 'صلاحية الموظف')}
            </label>

            <select
              id="manage-member-role"
              value={role}
              disabled={busy}
              onChange={(event) =>
                setRole(event.target.value as EditableRole)
              }
              style={fieldStyle}
            >
              {availableRoles.map((option) => (
                <option key={option} value={option}>
                  {option === 'ADMIN'
                    ? t('Admin', 'مسؤول')
                    : option === 'MANAGER'
                      ? t('Manager', 'مدير')
                      : option === 'ACCOUNTANT'
                        ? t('Accountant', 'محاسب')
                        : t('Sales Employee', 'موظف مبيعات')}
                </option>
              ))}
            </select>

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
              disabled={
                busy || role === toEditableRole(member.role)
              }
              onClick={() => void updateMember('role', role)}
              style={{
                width: '100%',
                padding: 13,
                marginBottom: 12,
                border: 0,
                borderRadius: 10,
                background: '#34d399',
                color: '#052e24',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy
                ? t('Saving...', 'جارٍ الحفظ...')
                : t('Save Role', 'حفظ الصلاحية')}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleStatusChange}
              style={{
                width: '100%',
                padding: 13,
                marginBottom: 12,
                borderRadius: 10,
                border: '1px solid #64748b',
                background:
                  member.status === 'Active'
                    ? '#442329'
                    : '#174d3d',
                color:
                  member.status === 'Active'
                    ? '#fca5a5'
                    : '#86efac',
                cursor: 'pointer',
              }}
            >
              {member.status === 'Active'
                ? t('Disable Employee', 'تعطيل الموظف')
                : t('Reactivate Employee', 'إعادة تفعيل الموظف')}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              style={{
                width: '100%',
                padding: 13,
                borderRadius: 10,
                border: '1px solid #335c4e',
                background: '#253c34',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {t('Cancel', 'إلغاء')}
            </button>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

