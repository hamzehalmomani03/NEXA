import './App.css';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import Inventory from './Inventory';
import Products from './Products';
import Sales from './Sales';
import Login from './Login';
import Invoices from './Invoices';
import Customers from './Customers';
import Reports from './Reports';
import Settings from './Settings';
import Team from './Team';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type Product = {
  id: string;
  name: string;
  sku: string;
  price: string | number;
  stockQuantity: number;
  lowStockAt: number;
};

type SaleItem = {
  quantity: number;
  product?: { id: string; name: string; sku: string } | null;
};

type Sale = {
  id: string;
  invoiceNumber?: string;
  totalAmount: string | number;
  subtotal?: string | number;
  status: string;
  createdAt: string;
  items: SaleItem[];
};

function tr(language: string, en: string, ar: string) {
  return language.startsWith('ar') ? ar : en;
}

const navigation = [
  { icon: '◫', label: 'Overview', path: '/overview' },
  { icon: '▦', label: 'Products', path: '/products' },
  { icon: '⇄', label: 'Inventory', path: '/inventory' },
  { icon: '↗', label: 'Sales', path: '/sales' },
  { icon: '▤', label: 'Invoices', path: '/invoices' },
  { icon: '◎', label: 'Customers', path: '/customers' },
];

const navigationTranslations: Record<string, string> = {
  Overview: 'نظرة عامة',
  Products: 'المنتجات',
  Inventory: 'المخزون',
  Sales: 'المبيعات',
  Invoices: 'الفواتير',
  Customers: 'العملاء',
  Reports: 'التقارير',
  'Reports & Analytics': 'التقارير والتحليلات',
  'Team Members': 'أعضاء الفريق',
  Settings: 'الإعدادات',
};

function Overview() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const locale = language.startsWith('ar') ? 'ar-JO' : 'en-US';

  const userText = localStorage.getItem('nexa_user');

  let overviewUser: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null = null;

  try {
    overviewUser = userText
      ? (JSON.parse(userText) as {
          firstName?: string;
          lastName?: string;
          email?: string;
        })
      : null;
  } catch {
    overviewUser = null;
  }

  const displayName =
    [overviewUser?.firstName, overviewUser?.lastName]
      .filter(Boolean)
      .join(' ') ||
    overviewUser?.email ||
    'NEXA User';

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('nexa_token');

  let organizationId = '';

  try {
    const organizationText = localStorage.getItem('nexa_organization');
    organizationId = organizationText
      ? JSON.parse(organizationText).id || ''
      : '';
  } catch {
    organizationId = '';
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      if (!token || !organizationId) {
        setError(
          tr(
            language,
            'Please sign in and select an organization.',
            'يرجى تسجيل الدخول واختيار المؤسسة.',
          ),
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const query = `organizationId=${encodeURIComponent(organizationId)}`;

        const [salesResponse, productsResponse, stockResponse] =
          await Promise.all([
            fetch(`${API_URL}/sales?${query}`, {
              headers,
              signal: controller.signal,
            }),
            fetch(`${API_URL}/products?${query}`, {
              headers,
              signal: controller.signal,
            }),
            fetch(`${API_URL}/inventory/low-stock?${query}`, {
              headers,
              signal: controller.signal,
            }),
          ]);

        if (
          !salesResponse.ok ||
          !productsResponse.ok ||
          !stockResponse.ok
        ) {
          throw new Error(
            tr(
              language,
              'Could not load dashboard data. Please check your session and backend.',
              'تعذر تحميل بيانات لوحة التحكم. تحقق من تسجيل الدخول والـ Backend.',
            ),
          );
        }

        const salesData = await salesResponse.json();
        const productsData = await productsResponse.json();
        const stockData = await stockResponse.json();

        const loadedSales: Sale[] = Array.isArray(salesData)
          ? salesData
          : Array.isArray(salesData.sales)
            ? salesData.sales
            : [];

        const loadedProducts: Product[] = Array.isArray(productsData)
          ? productsData
          : Array.isArray(productsData.products)
            ? productsData.products
            : [];

        const loadedLowStock = Array.isArray(stockData.products)
          ? stockData.products.filter(
              (product: Product) => product.stockQuantity > 0,
            ).length
          : 0;

        if (!controller.signal.aborted) {
          setSales(loadedSales);
          setProducts(loadedProducts);
          setLowStockCount(loadedLowStock);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : tr(
                language,
                'An unexpected error occurred.',
                'حدث خطأ غير متوقع.',
              ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [token, organizationId, language]);

  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount || 0),
    0,
  );

  const totalProducts = products.length;

  const inStock = products.filter(
    (product) => product.stockQuantity > product.lowStockAt,
  ).length;

  const outOfStock = products.filter(
    (product) => product.stockQuantity <= 0,
  ).length;

  const lowStock = products.filter(
    (product) =>
      product.stockQuantity > 0 &&
      product.stockQuantity <= product.lowStockAt,
  ).length;

  const totalInventory = inStock + lowStock + outOfStock;
  const now = new Date();

  const greeting = (() => {
    const hour = now.getHours();

    if (hour < 12) {
      return tr(language, 'Good morning', 'صباح الخير');
    }

    if (hour < 17) {
      return tr(language, 'Good afternoon', 'مساء الخير');
    }

    return tr(language, 'Good evening', 'مساء الخير');
  })();

  const todayLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  const dailyRevenue = lastSevenDays.map((date) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    return sales
      .filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        return saleDate >= date && saleDate < nextDate;
      })
      .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  });

  const sevenDayRevenue = dailyRevenue.reduce(
    (sum, amount) => sum + amount,
    0,
  );

  const chartMax = Math.max(1, ...dailyRevenue);
  const chartStep = Math.max(1, Math.ceil(chartMax / 4 / 100) * 100);
  const chartTop = chartStep * 4;

  const chartPoints = dailyRevenue.map((amount, index) => ({
    x: (index / 6) * 650,
    y: 170 - (amount / chartTop) * 150,
  }));

  const chartLinePath = chartPoints
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`,
    )
    .join(' ');

  const chartAreaPath = `${chartLinePath} L650 190 L0 190 Z`;

  const chartYLabels = [4, 3, 2, 1, 0].map(
    (step) => chartStep * step,
  );

  const inventoryPercent = (count: number) =>
    totalInventory ? (count / totalInventory) * 100 : 0;

  const inStockPercent = inventoryPercent(inStock);
  const lowStockPercent = inventoryPercent(lowStock);

  const donutBackground = totalInventory
    ? `conic-gradient(
        #34d399 0% ${inStockPercent}%,
        #fbbf24 ${inStockPercent}% ${inStockPercent + lowStockPercent}%,
        #fb7185 ${inStockPercent + lowStockPercent}% 100%
      )`
    : '#e5e7eb';

  const stats = [
    {
      label: tr(language, 'Total Revenue', 'إجمالي الإيرادات'),
      value: money(totalRevenue),
      description: tr(language, 'All recorded sales', 'جميع المبيعات المسجلة'),
      icon: '↗',
    },
    {
      label: tr(language, 'Total Sales', 'إجمالي المبيعات'),
      value: sales.length.toLocaleString(locale),
      description: tr(language, 'Recorded transactions', 'المعاملات المسجلة'),
      icon: '◈',
    },
    {
      label: tr(language, 'Products', 'المنتجات'),
      value: totalProducts.toLocaleString(locale),
      description: tr(language, 'Active products', 'المنتجات النشطة'),
      icon: '▦',
    },
    {
      label: tr(language, 'Low Stock Items', 'منتجات منخفضة المخزون'),
      value: lowStockCount.toLocaleString(locale),
      description: tr(language, 'Need attention', 'تحتاج إلى متابعة'),
      icon: '!',
    },
  ];

  const recentSales = [...sales]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const statusLabel = (status: string) => {
    const normalized = status.toUpperCase();

    if (normalized === 'COMPLETED') {
      return tr(language, 'Completed', 'مكتملة');
    }

    if (normalized === 'PENDING') {
      return tr(language, 'Pending', 'قيد الانتظار');
    }

    if (normalized === 'CANCELLED') {
      return tr(language, 'Cancelled', 'ملغاة');
    }

    return status;
  };

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            {todayLabel}
          </div>

          <h1>
            {greeting}، {displayName}{' '}
            <span className="wave">✳</span>
          </h1>

          <p className="welcome-description">
            {tr(
              language,
              "Here's what's happening with your business today.",
              'إليك ملخص ما يحدث في أعمالك اليوم.',
            )}
          </p>
        </div>

        <div className="welcome-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => window.print()}
          >
            <span>⇩</span>{' '}
            {tr(language, 'Export report', 'تصدير التقرير')}
          </button>

          <Link to="/sales" className="primary-button">
            <span>＋</span> {tr(language, 'New sale', 'عملية بيع جديدة')}
          </Link>
        </div>
      </section>

      {error && (
        <div className="panel" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => window.location.reload()}
          >
            {tr(language, 'Retry', 'إعادة المحاولة')}
          </button>
        </div>
      )}

      <section
        className="stats-grid"
        aria-label={tr(language, 'Business statistics', 'إحصائيات الأعمال')}
      >
        {stats.map((stat, index) => (
          <motion.article
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{
              opacity: { duration: 0.4, delay: index * 0.08 },
              y: { duration: 0.4, delay: index * 0.08 },
              scale: {
                type: 'spring',
                stiffness: 350,
                damping: 25,
              },
            }}
          >
            <div className="stat-top">
              <span className="stat-label">{stat.label}</span>
              <span className={`stat-icon stat-icon-${index}`}>
                {stat.icon}
              </span>
            </div>

            <div className="stat-value">
              {loading ? '...' : stat.value}
            </div>

            <div className="stat-footer">
              {index === 3 ? (
                <span className="warning-change">
                  ● {stat.description}
                </span>
              ) : (
                <span className="stat-period">{stat.description}</span>
              )}
            </div>

            <div className="stat-card-glow" />
          </motion.article>
        ))}
      </section>

      <section className="middle-grid">
        <article className="panel revenue-panel">
          <div className="panel-header">
            <div>
              <h2>{tr(language, 'Revenue overview', 'نظرة عامة على الإيرادات')}</h2>
              <p>
                {tr(
                  language,
                  'Recorded revenue over the last 7 days',
                  'الإيرادات المسجلة خلال آخر 7 أيام',
                )}
              </p>
            </div>

            <span className="select-button">
              {tr(language, 'Last 7 days', 'آخر 7 أيام')}
            </span>
          </div>

          <div className="revenue-summary">
            <div className="revenue-number">
              {loading ? '...' : money(sevenDayRevenue)}
            </div>

            <div className="revenue-growth">
              <small>
                {tr(
                  language,
                  'Revenue in this period',
                  'الإيرادات خلال هذه الفترة',
                )}
              </small>
            </div>
          </div>

          <div className="chart">
            <div className="chart-grid-line line-one" />
            <div className="chart-grid-line line-two" />
            <div className="chart-grid-line line-three" />
            <div className="chart-grid-line line-four" />

            <div className="chart-y-labels">
              {chartYLabels.map((amount, index) => (
                <span key={index}>
                  {amount >= 1000
                    ? `$${(amount / 1000).toLocaleString(locale)}k`
                    : `$${amount.toLocaleString(locale)}`}
                </span>
              ))}
            </div>

            <svg
              className="revenue-svg"
              viewBox="0 0 650 190"
              preserveAspectRatio="none"
              role="img"
              aria-label={tr(
                language,
                'Revenue chart based on recorded sales',
                'مخطط الإيرادات بناءً على المبيعات المسجلة',
              )}
            >
              <defs>
                <linearGradient
                  id="revenueFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#34d399" stopOpacity=".24" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>

              {sales.length > 0 && (
                <>
                  <path className="chart-area" d={chartAreaPath} />
                  <path className="chart-line" d={chartLinePath} />
                  <circle
                    cx={chartPoints[6].x}
                    cy={chartPoints[6].y}
                    r="5"
                    className="chart-point"
                  />
                </>
              )}
            </svg>

            <div className="chart-x-labels">
              {lastSevenDays.map((date) => (
                <span key={date.toISOString()}>
                  {new Intl.DateTimeFormat(locale, {
                    weekday: 'short',
                  }).format(date)}
                </span>
              ))}
            </div>
          </div>

          {!loading && sales.length === 0 && (
            <p>
              {tr(
                language,
                'No sales recorded yet.',
                'لا توجد مبيعات مسجلة حتى الآن.',
              )}
            </p>
          )}
        </article>

        <article className="panel inventory-panel">
          <div className="panel-header">
            <div>
              <h2>{tr(language, 'Inventory status', 'حالة المخزون')}</h2>
              <p>
                {tr(language, 'Overview of your stock', 'نظرة عامة على مخزونك')}
              </p>
            </div>

            <button
              className="dots-button"
              type="button"
              aria-label={tr(
                language,
                'More inventory options',
                'خيارات إضافية للمخزون',
              )}
            >
              ···
            </button>
          </div>

          <div className="inventory-visual">
            <div
              className="donut-chart"
              style={{ background: donutBackground }}
            >
              <div className="donut-center">
                <strong>
                  {loading ? '...' : totalProducts.toLocaleString(locale)}
                </strong>
                <span>{tr(language, 'Products', 'المنتجات')}</span>
              </div>
            </div>
          </div>

          <div className="inventory-legend">
            <div>
              <span className="legend-dot legend-green" />
              <span>{tr(language, 'In stock', 'متوفر')}</span>
              <strong>{loading ? '...' : inStock.toLocaleString(locale)}</strong>
              <small>{inventoryPercent(inStock).toFixed(1)}%</small>
            </div>

            <div>
              <span className="legend-dot legend-yellow" />
              <span>{tr(language, 'Low stock', 'مخزون منخفض')}</span>
              <strong>{loading ? '...' : lowStock.toLocaleString(locale)}</strong>
              <small>{inventoryPercent(lowStock).toFixed(1)}%</small>
            </div>

            <div>
              <span className="legend-dot legend-red" />
              <span>{tr(language, 'Out of stock', 'نفد المخزون')}</span>
              <strong>
                {loading ? '...' : outOfStock.toLocaleString(locale)}
              </strong>
              <small>{inventoryPercent(outOfStock).toFixed(1)}%</small>
            </div>
          </div>

          <Link to="/products" className="panel-link">
            {tr(language, 'View products', 'عرض المنتجات')} <span>→</span>
          </Link>
        </article>
      </section>

      <section className="panel sales-panel">
        <div className="panel-header sales-panel-header">
          <div>
            <h2>{tr(language, 'Recent sales', 'أحدث المبيعات')}</h2>
            <p>
              {tr(
                language,
                'A quick look at your latest transactions',
                'نظرة سريعة على أحدث معاملاتك',
              )}
            </p>
          </div>

          <Link to="/sales" className="view-all-link">
            {tr(language, 'View all sales', 'عرض جميع المبيعات')} <span>→</span>
          </Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr(language, 'ORDER ID', 'رقم الطلب')}</th>
                <th>{tr(language, 'CUSTOMER', 'العميل')}</th>
                <th>{tr(language, 'PRODUCT', 'المنتج')}</th>
                <th>{tr(language, 'DATE', 'التاريخ')}</th>
                <th>{tr(language, 'AMOUNT', 'المبلغ')}</th>
                <th>{tr(language, 'STATUS', 'الحالة')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    {tr(language, 'Loading sales...', 'جاري تحميل المبيعات...')}
                  </td>
                </tr>
              ) : recentSales.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {tr(language, 'No sales yet.', 'لا توجد مبيعات حتى الآن.')}
                  </td>
                </tr>
              ) : (
                recentSales.map((sale) => {
                  const productNames = sale.items
                    .map((item) => item.product?.name)
                    .filter(Boolean);

                  const statusClass = sale.status.toLowerCase();

                  return (
                    <tr key={sale.id}>
                      <td className="order-id">
                        {sale.invoiceNumber || sale.id}
                      </td>

                      <td>
                        <div className="customer-cell">
                          <span className="customer-avatar">—</span>
                          <span>
                            {tr(language, 'Not recorded', 'غير مسجل')}
                          </span>
                        </div>
                      </td>

                      <td className="product-cell">
                        {productNames.length > 0
                          ? productNames.join(', ')
                          : tr(language, 'No product details', 'لا توجد تفاصيل للمنتج')}
                      </td>

                      <td className="date-cell">
                        {formatDate(sale.createdAt)}
                      </td>

                      <td className="amount-cell">
                        {money(Number(sale.totalAmount || 0))}
                      </td>

                      <td>
                        <span className={`sale-status ${statusClass}`}>
                          <span />
                          {statusLabel(sale.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>
          © 2026 NEXA.{' '}
          {tr(language, 'Built for better business.', 'لإدارة أعمال أفضل.')}
        </span>
        <span>
          <span className="footer-status-dot" />
          {loading
            ? tr(language, 'Loading data...', 'جاري تحميل البيانات...')
            : error
              ? tr(language, 'Data unavailable', 'البيانات غير متاحة')
              : tr(language, 'Data loaded', 'تم تحميل البيانات')}
        </span>
      </footer>
    </>
  );
}

function DashboardLayout() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const language = i18n.language;
  const isArabic = language.startsWith('ar');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.lang = isArabic ? 'ar' : 'en';
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [isArabic]);

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function handleLanguageChange() {
    const nextLanguage = isArabic ? 'en' : 'ar';

    localStorage.setItem('nexa_language', nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  }

  const currentPath = location.pathname;

  const currentPage =
    navigation.find((item) => item.path === currentPath)?.label ??
    ({
      '/reports': 'Reports & Analytics',
      '/team': 'Team Members',
      '/settings': 'Settings',
    }[currentPath] ?? 'Overview');

  const organizationText = localStorage.getItem('nexa_organization');
  const userText = localStorage.getItem('nexa_user');

  let organization: { name?: string } | null = null;
  let user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null = null;

  try {
    organization = organizationText
      ? (JSON.parse(organizationText) as { name?: string })
      : null;
  } catch {
    organization = null;
  }

  try {
    user = userText
      ? (JSON.parse(userText) as {
          firstName?: string;
          lastName?: string;
          email?: string;
        })
      : null;
  } catch {
    user = null;
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'NEXA User';

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleLogout() {
    localStorage.removeItem('nexa_token');
    localStorage.removeItem('nexa_user');
    localStorage.removeItem('nexa_organization');

    sessionStorage.removeItem('nexa_token');
    sessionStorage.removeItem('nexa_user');
    sessionStorage.removeItem('nexa_organization');

    window.location.replace('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/overview" aria-label="NEXA home">
          <span className="brand-mark">N</span>
          <span className="brand-name">
            NEXA<span>.</span>
          </span>
        </Link>

        <div className="workspace">
          <div className="workspace-icon">N</div>
          <div className="workspace-info">
            <strong>{organization?.name || 'NEXA Workspace'}</strong>
            <span>{tr(language, 'Business account', 'حساب تجاري')}</span>
          </div>
          <span className="workspace-chevron">⌄</span>
        </div>

        <div className="nav-section-label">
          {tr(language, 'WORKSPACE', 'مساحة العمل')}
        </div>

        <nav
          className="navigation"
          aria-label={tr(language, 'Main navigation', 'التنقل الرئيسي')}
        >
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item${currentPath === item.path ? ' active' : ''}`}
              aria-current={currentPath === item.path ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>
                {isArabic
                  ? navigationTranslations[item.label]
                  : item.label}
              </span>

              {item.label === 'Inventory' && (
                <span className="nav-count">12</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="nav-section-label management-label">
          {tr(language, 'MANAGEMENT', 'الإدارة')}
        </div>

        <nav
          className="navigation"
          aria-label={tr(language, 'Management navigation', 'قائمة الإدارة')}
        >
          <Link
            to="/reports"
            className={`nav-item${currentPath === '/reports' ? ' active' : ''}`}
            aria-current={currentPath === '/reports' ? 'page' : undefined}
          >
            <span className="nav-icon">▥</span>
            <span>
              {tr(language, 'Reports & Analytics', 'التقارير والتحليلات')}
            </span>
          </Link>

          <Link
            to="/team"
            className={`nav-item${currentPath === '/team' ? ' active' : ''}`}
            aria-current={currentPath === '/team' ? 'page' : undefined}
          >
            <span className="nav-icon">♧</span>
            <span>{tr(language, 'Team Members', 'أعضاء الفريق')}</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-symbol">✳</div>
            <strong>
              {tr(language, 'Unlock your potential', 'اكتشف إمكانياتك')}
            </strong>
            <p>
              {tr(
                language,
                'Get more insights and grow your business with NEXA.',
                'احصل على رؤى أعمق وطوّر أعمالك مع NEXA.',
              )}
            </p>
            <button className="upgrade-button" type="button">
              {tr(language, 'Explore features', 'استكشف المزايا')} <span>↗</span>
            </button>
          </div>

          <Link
            to="/settings"
            className={`nav-item settings-link${currentPath === '/settings' ? ' active' : ''}`}
            aria-current={currentPath === '/settings' ? 'page' : undefined}
          >
            <span className="nav-icon">⚙</span>
            <span>{tr(language, 'Settings', 'الإعدادات')}</span>
          </Link>

          <div className="profile">
            <div className="avatar">{initials}</div>
            <div className="profile-info">
              <strong>{displayName}</strong>
              <span>{tr(language, 'Signed in', 'تم تسجيل الدخول')}</span>
            </div>
            <button
              className="profile-menu"
              type="button"
              aria-label={tr(language, 'Sign out', 'تسجيل الخروج')}
              title={tr(language, 'Sign out', 'تسجيل الخروج')}
              onClick={handleLogout}
            >
              ↪
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{tr(language, 'Workspace', 'مساحة العمل')}</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {isArabic
                ? navigationTranslations[currentPage] ?? currentPage
                : currentPage}
            </strong>
          </div>

          <div className="header-brand">
            <img
              className="header-emblem"
              src="https://commons.wikimedia.org/wiki/Special:FilePath/Jordan_Coat_of_Arms.jpg"
              alt="شعار المملكة الأردنية الهاشمية"
            />
            <span className="brand-name">NEXA</span>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={handleLanguageChange}
              aria-label={tr(language, 'Change language', 'تغيير اللغة')}
            >
              {isArabic ? 'English' : 'العربية'}
            </button>

            <div className="system-status">
              <span className="status-dot" />
              {tr(
                language,
                'All systems operational',
                'جميع الأنظمة تعمل بشكل طبيعي',
              )}
            </div>

            <button
              className="icon-button notification-button"
              type="button"
              aria-label={tr(language, 'Notifications', 'الإشعارات')}
            >
              ♧<span className="notification-dot" />
            </button>

            <div className="topbar-profile-wrapper" ref={profileMenuRef}>
              <button
                className="topbar-avatar"
                type="button"
                aria-label={tr(language, 'Open profile menu', 'فتح قائمة الحساب')}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                {initials}
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-avatar">{initials}</div>

                    <div className="profile-dropdown-user">
                      <strong>{displayName}</strong>
                      <span>{user?.email || ''}</span>
                      <small>
                        {tr(language, 'NEXA Workspace', 'مساحة عمل NEXA')}
                      </small>
                    </div>
                  </div>

                  <div className="profile-dropdown-divider" />

                  <Link
                    to="/settings"
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <span>⚙</span>
                    {tr(language, 'Account settings', 'إعدادات الحساب')}
                    <span className="profile-dropdown-arrow">›</span>
                  </Link>

                  <Link
                    to="/team"
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <span>♧</span>
                    {tr(language, 'Team members', 'أعضاء الفريق')}
                    <span className="profile-dropdown-arrow">›</span>
                  </Link>

                  <div className="profile-dropdown-divider" />

                  <button
                    className="profile-dropdown-item profile-logout"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <span>↪</span>
                    {tr(language, 'Sign out', 'تسجيل الخروج')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/team" element={<Team />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  const token = localStorage.getItem('nexa_token');
  const location = useLocation();

  if (location.pathname === '/login') {
    return token ? (
      <Navigate to="/products" replace />
    ) : (
      <>
        <Login />
      </>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout />;
}

export default App;
