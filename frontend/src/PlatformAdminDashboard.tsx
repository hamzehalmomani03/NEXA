import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import './PlatformAdminDashboard.css';
 
const API_URL = import.meta.env.VITE_API_URL ?? '/api';
 
type Organization = {
  id: string;
  name?: string;
  slug?: string;
  isActive: boolean;
  createdAt?: string;
  memberCount?: number;
  usersCount?: number;
  productsCount?: number;
  _count?: { members?: number; users?: number; products?: number };
};
 
type PlatformUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isSystemAdmin: boolean;
  createdAt: string;
  organizationsCount?: number;
  memberships?: Array<{ organizationId: string }>;
};
 
type PlatformProduct = {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  stockQuantity: number;
  status: 'ACTIVE' | 'ARCHIVED' | string;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
    slug?: string;
  };
};
 
type PlatformSection =
  | 'overview'
  | 'organizations'
  | 'users'
  | 'products';
 
type Stats = {
  organizations: number;
  users: number;
  activeUsers: number;
  products: number;
  completedSalesCount: number;
  completedSalesTotal: number | string;
};
 
const emptyStats: Stats = {
  organizations: 0,
  users: 0,
  activeUsers: 0,
  products: 0,
  completedSalesCount: 0,
  completedSalesTotal: 0,
};
 
async function readJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
 
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا.'
        : response.status === 403
          ? 'هذا الحساب لا يملك صلاحية Super Admin.'
          : data.message || 'تعذر تحميل البيانات من الخادم.',
    );
  }
 
  return data;
}
 
function unwrap(value: any): any {
  return value?.data ?? value;
}
 
function asList<T>(value: any, key: string): T[] {
  const data = unwrap(value);
 
  if (Array.isArray(data)) return data;
 
  const list =
    data?.[key] ??
    data?.items ??
    data?.results ??
    [];
 
  return Array.isArray(list) ? list : [];
}
 
function formatNumber(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
}
 
function formatDate(value?: string): string {
  if (!value) return '—';
 
  const date = new Date(value);
 
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString();
}
 
function userName(user: PlatformUser): string {
  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
 
  return name || user.email || 'Unnamed user';
}
 
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview:
      'M3 3h7v7H3z M14 3h7v4h-7z M14 10h7v11h-7z M3 14h7v7H3z',
    organizations:
      'M3 21V7l9-4 9 4v14 M9 21v-5h6v5 M7 9h2 M15 9h2 M7 12h2 M15 12h2',
    users:
      'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6',
    sales: 'M3 3v18h18 M7 14l4-4 4 3 6-7',
    security:
      'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11 M9 12l2 2 4-4',
    refresh:
      'M20 7v5h-5 M4 17v-5h5 M5.6 9a7 7 0 0 1 11.6-2L20 12 M4 12l2.8 5a7 7 0 0 0 11.6-2',
    arrow: 'M5 12h14 M12 5l7 7-7 7',
    search:
      'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M21 21l-4.3-4.3',
    logout:
      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  };
 
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.overview} />
    </svg>
  );
}
 
export default function PlatformAdminDashboard() {
  const navigate = useNavigate();
 
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [products, setProducts] = useState<PlatformProduct[]>([]);
 
  const [section, setSection] =
    useState<PlatformSection>('overview');
 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
 
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userActionMessage, setUserActionMessage] = useState('');
  const [userActionError, setUserActionError] = useState(false);
 
  const [updatingOrganizationId, setUpdatingOrganizationId] =
    useState<string | null>(null);
  const [organizationActionMessage, setOrganizationActionMessage] =
    useState('');
  const [organizationActionError, setOrganizationActionError] =
    useState(false);
 
  const loadDashboard = useCallback(
    async (quiet = false) => {
      const token = localStorage.getItem('nexa_token');
 
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }
 
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
 
      setError('');
 
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };
 
        const [
          statsResponse,
          organizationsResponse,
          usersResponse,
          productsResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/platform-admin/dashboard`, { headers }),
          fetch(`${API_URL}/platform-admin/organizations`, { headers }),
          fetch(`${API_URL}/platform-admin/users`, { headers }),
          fetch(`${API_URL}/platform-admin/products`, { headers }),
        ]);
 
        const [
          statsJson,
          organizationsJson,
          usersJson,
          productsJson,
        ] = await Promise.all([
          readJson(statsResponse),
          readJson(organizationsResponse),
          readJson(usersResponse),
          readJson(productsResponse),
        ]);
 
        const rawStats = unwrap(statsJson) ?? {};
 
        setStats({
          organizations: Number(rawStats.organizations ?? 0),
          users: Number(rawStats.users ?? 0),
          activeUsers: Number(rawStats.activeUsers ?? 0),
          products: Number(rawStats.products ?? 0),
          completedSalesCount: Number(
            rawStats.completedSalesCount ?? 0,
          ),
          completedSalesTotal: Number(
            rawStats.completedSalesTotal ?? 0,
          ),
        });
 
        setOrganizations(
          asList<Organization>(
            organizationsJson,
            'organizations',
          ),
        );
 
        setUsers(
          asList<PlatformUser>(usersJson, 'users'),
        );
 
        setProducts(
          asList<PlatformProduct>(productsJson, 'products'),
        );
 
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'حدث خطأ غير متوقع.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate],
  );
 
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);
 
  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
 
    if (!term) return organizations;
 
    return organizations.filter((organization) =>
      `${organization.name ?? ''} ${organization.slug ?? ''} ${organization.id}`
        .toLowerCase()
        .includes(term),
    );
  }, [organizations, search]);
 
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
 
    if (!term) return users;
 
    return users.filter((user) =>
      `${userName(user)} ${user.email} ${user.id}`
        .toLowerCase()
        .includes(term),
    );
  }, [users, search]);
 
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
 
    if (!term) return products;
 
    return products.filter((product) =>
      `${product.name} ${product.sku} ${product.organization?.name ?? ''} ${product.id}`
        .toLowerCase()
        .includes(term),
    );
  }, [products, search]);
 
  const metrics = [
    {
      label: 'Total organizations',
      value: stats.organizations,
      icon: 'organizations',
      color: 'mint',
      note: 'Registered on NEXA',
    },
    {
      label: 'Total users',
      value: stats.users,
      icon: 'users',
      color: 'blue',
      note: `${stats.activeUsers} active users`,
    },
    {
      label: 'Products tracked',
      value: stats.products,
      icon: 'overview',
      color: 'purple',
      note: 'Across the platform',
    },
    {
      label: 'Completed sales',
      value: stats.completedSalesCount,
      icon: 'sales',
      color: 'amber',
      note: `${formatNumber(stats.completedSalesTotal)} JOD total`,
    },
  ];
 
  const sectionTitles: Record<PlatformSection, string> = {
    overview: 'Overview',
    organizations: 'Organizations',
    users: 'Users',
    products: 'Products',
  };
 
  function logout() {
    localStorage.removeItem('nexa_token');
    localStorage.removeItem('nexa_user');
    localStorage.removeItem('nexa_organization');
 
    sessionStorage.removeItem('nexa_token');
    sessionStorage.removeItem('nexa_user');
    sessionStorage.removeItem('nexa_organization');
 
    navigate('/login', { replace: true });
  }
 
  function changeSection(next: PlatformSection) {
    setSection(next);
    setSearch('');
 
    setUserActionMessage('');
    setUserActionError(false);
 
    setOrganizationActionMessage('');
    setOrganizationActionError(false);
  }
 
  async function toggleUserStatus(user: PlatformUser) {
    if (user.isSystemAdmin || updatingUserId) return;
 
    const token = localStorage.getItem('nexa_token');
 
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
 
    const nextStatus = !user.isActive;
 
    setUpdatingUserId(user.id);
    setUserActionMessage('');
    setUserActionError(false);
 
    try {
      const response = await fetch(
        `${API_URL}/platform-admin/users/${encodeURIComponent(user.id)}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive: nextStatus }),
        },
      );
 
      await readJson(response);
 
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? { ...currentUser, isActive: nextStatus }
            : currentUser,
        ),
      );
 
      setStats((currentStats) => ({
        ...currentStats,
        activeUsers: Math.max(
          0,
          currentStats.activeUsers + (nextStatus ? 1 : -1),
        ),
      }));
 
      setUserActionMessage(
        nextStatus
          ? `تم تفعيل حساب ${user.email} بنجاح.`
          : `تم تعطيل حساب ${user.email} بنجاح.`,
      );
    } catch (err) {
      setUserActionError(true);
      setUserActionMessage(
        err instanceof Error
          ? err.message
          : 'تعذر تغيير حالة المستخدم.',
      );
    } finally {
      setUpdatingUserId(null);
    }
  }
 
  async function toggleOrganizationStatus(
    organization: Organization,
  ) {
    if (updatingOrganizationId) return;
 
    const token = localStorage.getItem('nexa_token');
 
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
 
    const nextStatus = !organization.isActive;
 
    setUpdatingOrganizationId(organization.id);
    setOrganizationActionMessage('');
    setOrganizationActionError(false);
 
    try {
      const response = await fetch(
        `${API_URL}/platform-admin/organizations/${encodeURIComponent(
          organization.id,
        )}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive: nextStatus }),
        },
      );
 
      await readJson(response);
 
      setOrganizations((currentOrganizations) =>
        currentOrganizations.map((currentOrganization) =>
          currentOrganization.id === organization.id
            ? { ...currentOrganization, isActive: nextStatus }
            : currentOrganization,
        ),
      );
 
      setOrganizationActionMessage(
        nextStatus
          ? `تم تفعيل المؤسسة ${organization.name || organization.slug || organization.id} بنجاح.`
          : `تم تعطيل المؤسسة ${organization.name || organization.slug || organization.id} بنجاح.`,
      );
    } catch (err) {
      setOrganizationActionError(true);
      setOrganizationActionMessage(
        err instanceof Error
          ? err.message
          : 'تعذر تغيير حالة المؤسسة.',
      );
    } finally {
      setUpdatingOrganizationId(null);
    }
  }
 
  return (
    <div className="pa-shell">
      <aside className="pa-sidebar">
        <div className="pa-brand">
          <div className="pa-brand-mark">
            N<span>.</span>
          </div>
          <div>
            <div className="pa-brand-name">NEXA</div>
            <div className="pa-brand-sub">COMMAND CENTER</div>
          </div>
        </div>
 
        <div className="pa-workspace-label">
          PLATFORM CONTROL
        </div>
 
        <nav className="pa-nav">
          {(
            [
              ['overview', 'Overview', 'overview'],
              ['organizations', 'Organizations', 'organizations'],
              ['users', 'Users', 'users'],
              ['products', 'Products', 'overview'],
            ] as [PlatformSection, string, string][]
          ).map(([key, label, iconName]) => (
            <button
              key={key}
              className={`pa-nav-item ${
                section === key ? 'active' : ''
              }`}
              onClick={() => changeSection(key)}
            >
              <Icon name={iconName} />
              <span>{label}</span>
 
              {section === key && (
                <span className="pa-nav-dot" />
              )}
 
              {key === 'organizations' && (
                <span className="pa-nav-count">
                  {stats.organizations}
                </span>
              )}
 
              {key === 'users' && (
                <span className="pa-nav-count">
                  {stats.users}
                </span>
              )}
 
              {key === 'products' && (
                <span className="pa-nav-count">
                  {stats.products}
                </span>
              )}
            </button>
          ))}
        </nav>
 
        <div className="pa-sidebar-bottom">
          <div className="pa-secure-card">
            <div className="pa-secure-icon">
              <Icon name="security" />
            </div>
            <div className="pa-secure-title">
              Platform protected
            </div>
            <div className="pa-secure-copy">
              Administrative access is verified by the server.
            </div>
            <div className="pa-secure-status">
              <span /> AUTHENTICATED SESSION
            </div>
          </div>
 
          <button className="pa-logout" onClick={logout}>
            <Icon name="logout" /> Sign out
          </button>
 
          <div className="pa-version">
            NEXA PLATFORM · v1.0
          </div>
        </div>
      </aside>
 
      <main className="pa-main">
        <header className="pa-topbar">
          <div className="pa-breadcrumb">
            <span>Platform</span>
            <span className="pa-crumb-slash">/</span>
            <strong>{sectionTitles[section]}</strong>
          </div>
 
          <div className="pa-topbar-right">
            <div className="pa-live">
              <span /> LIVE PLATFORM
            </div>
            <div className="pa-avatar">H</div>
            <div className="pa-admin-identity">
              <strong>Platform Admin</strong>
              <span>Super administrator</span>
            </div>
          </div>
        </header>
 
        <div className="pa-content">
          <motion.div
            className="pa-heading-row"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div>
              <div className="pa-eyebrow">
                <span /> SYSTEM CONTROL
              </div>
 
              <h1>
                {section === 'overview' ? (
                  <>
                    Your platform.<br />
                    <span>Your command center.</span>
                  </>
                ) : (
                  <>
                    {sectionTitles[section]}{' '}
                    <span>directory.</span>
                  </>
                )}
              </h1>
 
              <p className="pa-heading-copy">
                {section === 'overview' &&
                  'A clear view of the entire NEXA ecosystem, all in one place.'}
                {section === 'organizations' &&
                  'Explore and search organizations registered across NEXA.'}
                {section === 'users' &&
                  'Review user accounts and their current account status.'}
                {section === 'products' &&
                  'Explore products across organizations on the platform.'}
              </p>
            </div>
 
            <button
              className="pa-refresh"
              onClick={() => void loadDashboard(true)}
              disabled={refreshing || loading}
            >
              <span className={refreshing ? 'pa-spin' : ''}>
                <Icon name="refresh" />
              </span>
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          </motion.div>
 
          {lastUpdated && (
            <div className="pa-updated">
              <span className="pa-updated-dot" />
              Data synced {lastUpdated.toLocaleTimeString()}
            </div>
          )}
 
          {error && (
            <div className="pa-error">
              <div>
                <strong>Unable to load platform data</strong>
                <p>{error}</p>
              </div>
              <button onClick={() => void loadDashboard()}>
                Try again
              </button>
            </div>
          )}
 
          {section === 'overview' && (
            <>
              <div className="pa-section-heading">
                <div>
                  <span className="pa-section-kicker">
                    THE BIG PICTURE
                  </span>
                  <h2>Platform metrics</h2>
                </div>
                <span className="pa-period">
                  <span /> Live data
                </span>
              </div>
 
              <div className="pa-metrics-grid">
                {metrics.map((metric, index) => (
                  <motion.article
                    key={metric.label}
                    className="pa-metric-card"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.08,
                    }}
                    whileHover={{ y: -4 }}
                  >
                    <div className="pa-metric-top">
                      <span
                        className={`pa-metric-icon ${metric.color}`}
                      >
                        <Icon name={metric.icon} />
                      </span>
                      <span className="pa-metric-index">
                        0{index + 1}
                      </span>
                    </div>
 
                    <div className="pa-metric-value">
                      {loading ? (
                        <span className="pa-skeleton" />
                      ) : (
                        formatNumber(metric.value)
                      )}
                    </div>
 
                    <div className="pa-metric-label">
                      {metric.label}
                    </div>
 
                    <div className="pa-metric-bottom">
                      <span className="pa-metric-indicator" />
                      {metric.note}
                    </div>
                  </motion.article>
                ))}
              </div>
 
              <div className="pa-lower-grid">
                <section className="pa-panel pa-ecosystem">
                  <div className="pa-panel-header">
                    <div>
                      <span className="pa-section-kicker">
                        PLATFORM HEALTH
                      </span>
                      <h2>The ecosystem</h2>
                    </div>
                    <span className="pa-health-badge">
                      <span /> Connected
                    </span>
                  </div>
 
                  <div className="pa-ecosystem-visual">
                    <div className="pa-orbit pa-orbit-one" />
                    <div className="pa-orbit pa-orbit-two" />
                    <div className="pa-orbit pa-orbit-three" />
                    <div className="pa-orbit-core">
                      <span>N</span>
                      <small>NEXA</small>
                    </div>
                    <div className="pa-orbit-node node-top">
                      <Icon name="organizations" />
                    </div>
                    <div className="pa-orbit-node node-right">
                      <Icon name="users" />
                    </div>
                    <div className="pa-orbit-node node-bottom">
                      <Icon name="sales" />
                    </div>
                    <div className="pa-orbit-node node-left">
                      <Icon name="security" />
                    </div>
                  </div>
 
                  <div className="pa-ecosystem-legend">
                    <div>
                      <span className="legend-mint" />
                      Organizations
                      <strong>
                        {formatNumber(stats.organizations)}
                      </strong>
                    </div>
                    <div>
                      <span className="legend-blue" />
                      Active users
                      <strong>
                        {formatNumber(stats.activeUsers)}
                      </strong>
                    </div>
                    <div>
                      <span className="legend-purple" />
                      Products
                      <strong>
                        {formatNumber(stats.products)}
                      </strong>
                    </div>
                  </div>
                </section>
 
                <section className="pa-panel pa-activity">
                  <div className="pa-panel-header">
                    <div>
                      <span className="pa-section-kicker">
                        QUICK INSIGHTS
                      </span>
                      <h2>Platform snapshot</h2>
                    </div>
                    <span className="pa-snapshot-symbol">✳</span>
                  </div>
 
                  <div className="pa-insight">
                    <div className="pa-insight-icon mint">
                      <Icon name="organizations" />
                    </div>
                    <div className="pa-insight-copy">
                      <strong>Organizations registered</strong>
                      <span>Current platform total</span>
                    </div>
                    <strong className="pa-insight-number">
                      {formatNumber(stats.organizations)}
                    </strong>
                  </div>
 
                  <div className="pa-insight">
                    <div className="pa-insight-icon blue">
                      <Icon name="users" />
                    </div>
                    <div className="pa-insight-copy">
                      <strong>Active user accounts</strong>
                      <span>Accounts marked active</span>
                    </div>
                    <strong className="pa-insight-number">
                      {formatNumber(stats.activeUsers)}
                    </strong>
                  </div>
 
                  <div className="pa-insight">
                    <div className="pa-insight-icon purple">
                      <Icon name="overview" />
                    </div>
                    <div className="pa-insight-copy">
                      <strong>Product catalogue</strong>
                      <span>Products across NEXA</span>
                    </div>
                    <strong className="pa-insight-number">
                      {formatNumber(stats.products)}
                    </strong>
                  </div>
 
                  <button
                    className="pa-text-link"
                    onClick={() => changeSection('organizations')}
                  >
                    Explore organizations
                    <Icon name="arrow" />
                  </button>
 
                  <button
                    className="pa-text-link"
                    onClick={() => changeSection('users')}
                  >
                    Explore users
                    <Icon name="arrow" />
                  </button>
 
                  <button
                    className="pa-text-link"
                    onClick={() => changeSection('products')}
                  >
                    Explore products
                    <Icon name="arrow" />
                  </button>
                </section>
              </div>
            </>
          )}
 
          {section === 'organizations' && (
            <section className="pa-panel pa-org-panel">
              <div className="pa-panel-header pa-org-header">
                <div>
                  <span className="pa-section-kicker">
                    YOUR PLATFORM NETWORK
                  </span>
                  <h2>All organizations</h2>
                </div>
                <span className="pa-org-total">
                  {organizations.length} records
                </span>
              </div>
 
              <div className="pa-search-row">
                <div className="pa-search">
                  <Icon name="search" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by organization name or ID…"
                  />
                </div>
                <span className="pa-search-count">
                  {filteredOrganizations.length} results
                </span>
              </div>
 
              {organizationActionMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`pa-user-action-message ${
                    organizationActionError ? 'error' : 'success'
                  }`}
                >
                  {organizationActionMessage}
                </div>
              )}
 
              {loading ? (
                <div className="pa-empty">
                  <div className="pa-loader" />
                  <p>Loading organizations…</p>
                </div>
              ) : filteredOrganizations.length === 0 ? (
                <div className="pa-empty">
                  <div className="pa-empty-icon">
                    <Icon name="organizations" />
                  </div>
                  <strong>No organizations found</strong>
                  <p>Try another search term or refresh the data.</p>
                </div>
              ) : (
                <div className="pa-table-wrap">
                  <table className="pa-table">
                    <thead>
                      <tr>
                        <th>ORGANIZATION</th>
                        <th>IDENTIFIER</th>
                        <th>USERS</th>
                        <th>PRODUCTS</th>
                        <th>CREATED</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrganizations.map((organization) => (
                        <tr key={organization.id}>
                          <td>
                            <div className="pa-org-name-cell">
                              <span className="pa-org-avatar">
                                {(organization.name || 'O')
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </span>
                              <div>
                                <strong>
                                  {organization.name ||
                                    'Unnamed organization'}
                                </strong>
                                <span>
                                  {formatDate(organization.createdAt)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <code>
                              {organization.slug ||
                                `${organization.id.slice(0, 8)}…`}
                            </code>
                          </td>
                          <td>
                            {organization.usersCount ??
                              organization.memberCount ??
                              organization._count?.members ??
                              organization._count?.users ??
                              '—'}
                          </td>
                          <td>
                            {organization.productsCount ??
                              organization._count?.products ??
                              '—'}
                          </td>
                          <td>{formatDate(organization.createdAt)}</td>
                          <td>
                            <span
                              className={`pa-status ${
                                organization.isActive ? 'active' : 'inactive'
                              }`}
                            >
                              <span />
                              {organization.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`pa-user-action ${
                                organization.isActive ? 'deactivate' : 'activate'
                              }`}
                              disabled={updatingOrganizationId !== null}
                              onClick={() =>
                                void toggleOrganizationStatus(organization)
                              }
                            >
                              {updatingOrganizationId === organization.id
                                ? 'Please wait...'
                                : organization.isActive
                                  ? 'Deactivate'
                                  : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
 
          {section === 'users' && (
            <section className="pa-panel pa-org-panel">
              <div className="pa-panel-header pa-org-header">
                <div>
                  <span className="pa-section-kicker">
                    PLATFORM ACCOUNTS
                  </span>
                  <h2>All users</h2>
                </div>
                <span className="pa-org-total">
                  {users.length} records
                </span>
              </div>
 
              <div className="pa-search-row">
                <div className="pa-search">
                  <Icon name="search" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, email or ID…"
                  />
                </div>
                <span className="pa-search-count">
                  {filteredUsers.length} results
                </span>
              </div>
 
              {userActionMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`pa-user-action-message ${
                    userActionError ? 'error' : 'success'
                  }`}
                >
                  {userActionMessage}
                </div>
              )}
 
              {loading ? (
                <div className="pa-empty">
                  <div className="pa-loader" />
                  <p>Loading users…</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="pa-empty">
                  <div className="pa-empty-icon">
                    <Icon name="users" />
                  </div>
                  <strong>No users found</strong>
                  <p>Try another search term or refresh the data.</p>
                </div>
              ) : (
                <div className="pa-table-wrap">
                  <table className="pa-table">
                    <thead>
                      <tr>
                        <th>USER</th>
                        <th>EMAIL</th>
                        <th>ROLE</th>
                        <th>STATUS</th>
                        <th>CREATED</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="pa-org-name-cell">
                              <span className="pa-org-avatar">
                                {userName(user).slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <strong>{userName(user)}</strong>
                                <span>
                                  {user.organizationsCount ??
                                    user.memberships?.length ??
                                    '—'}{' '}
                                  organization(s)
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            {user.isSystemAdmin
                              ? 'Super Admin'
                              : 'User'}
                          </td>
                          <td>
                            <span
                              className={`pa-status ${
                                user.isActive ? 'active' : 'inactive'
                              }`}
                            >
                              <span />
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            {user.isSystemAdmin ? (
                              <span className="pa-protected-label">
                                Protected
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={`pa-user-action ${
                                  user.isActive ? 'deactivate' : 'activate'
                                }`}
                                disabled={updatingUserId !== null}
                                onClick={() => void toggleUserStatus(user)}
                              >
                                {updatingUserId === user.id
                                  ? 'Please wait...'
                                  : user.isActive
                                    ? 'Deactivate'
                                    : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
 
          {section === 'products' && (
            <section className="pa-panel pa-org-panel">
              <div className="pa-panel-header pa-org-header">
                <div>
                  <span className="pa-section-kicker">
                    GLOBAL CATALOGUE
                  </span>
                  <h2>All products</h2>
                </div>
                <span className="pa-org-total">
                  {products.length} records
                </span>
              </div>
 
              <div className="pa-search-row">
                <div className="pa-search">
                  <Icon name="search" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by product, SKU or organization…"
                  />
                </div>
                <span className="pa-search-count">
                  {filteredProducts.length} results
                </span>
              </div>
 
              {loading ? (
                <div className="pa-empty">
                  <div className="pa-loader" />
                  <p>Loading products…</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="pa-empty">
                  <div className="pa-empty-icon">
                    <Icon name="overview" />
                  </div>
                  <strong>No products found</strong>
                  <p>Try another search term or refresh the data.</p>
                </div>
              ) : (
                <div className="pa-table-wrap">
                  <table className="pa-table">
                    <thead>
                      <tr>
                        <th>PRODUCT</th>
                        <th>SKU</th>
                        <th>ORGANIZATION</th>
                        <th>PRICE</th>
                        <th>STOCK</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <div className="pa-org-name-cell">
                              <span className="pa-org-avatar">
                                {product.name.slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <strong>{product.name}</strong>
                                <span>{formatDate(product.createdAt)}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <code>{product.sku || '—'}</code>
                          </td>
                          <td>
                            {product.organization?.name || '—'}
                          </td>
                          <td>{formatNumber(product.price)} JOD</td>
                          <td>{formatNumber(product.stockQuantity)}</td>
                          <td>
                            <span
                              className={`pa-status ${
                                product.status === 'ACTIVE'
                                  ? 'active'
                                  : 'inactive'
                              }`}
                            >
                              <span />
                              {product.status === 'ACTIVE'
                                ? 'Active'
                                : product.status === 'ARCHIVED'
                                  ? 'Archived'
                                  : product.status || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
 
          <footer className="pa-footer">
            <span>
              <span className="pa-footer-mark">N</span>
              {' '}NEXA COMMAND CENTER
            </span>
            <span>Built for clarity. Designed for control.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
 