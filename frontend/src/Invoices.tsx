
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import './Invoices.css';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue';

interface Invoice {
  id: string;
  customer: string;
  email: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
}

interface SaleApi {
  id: string;
  invoiceNumber?: string | null;
  totalAmount?: number | string | null;
  subtotal?: number | string | null;
  status?: string | null;
  createdAt?: string | null;
}

function getOrganizationId(): string {
  const savedOrganization = localStorage.getItem('nexa_organization');

  if (!savedOrganization) {
    throw new Error('SESSION_EXPIRED');
  }

  let organization: { id?: string | number };

  try {
    organization = JSON.parse(savedOrganization);
  } catch {
    throw new Error('INVALID_ORGANIZATION');
  }

  if (
    organization.id === undefined ||
    organization.id === null ||
    String(organization.id).trim() === ''
  ) {
    throw new Error('INVALID_ORGANIZATION');
  }

  return String(organization.id);
}

const currency = (amount: number, isArabic: boolean) =>
  new Intl.NumberFormat(isArabic ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (date: string, isArabic: boolean) => {
  const parsedDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return parsedDate.toLocaleDateString(
    isArabic ? 'ar-JO' : 'en-GB',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  );
};

export default function Invoices() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [customer, setCustomer] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadInvoices() {
      setLoading(true);
      setApiError('');

      try {
        const token = localStorage.getItem('nexa_token');

        if (!token) {
          throw new Error('SESSION_EXPIRED');
        }

        const organizationId = getOrganizationId();

        const response = await fetch(
          `${API_URL}/sales?organizationId=${encodeURIComponent(
            organizationId,
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          },
        );

        if (response.status === 401 || response.status === 403) {
          throw new Error('SESSION_EXPIRED');
        }

        if (!response.ok) {
          throw new Error('API_ERROR');
        }

        const data: unknown = await response.json();

        let sales: SaleApi[] = [];

        if (Array.isArray(data)) {
          sales = data as SaleApi[];
        } else if (data && typeof data === 'object') {
          const result = data as Record<string, unknown>;

          if (Array.isArray(result.sales)) {
            sales = result.sales as SaleApi[];
          } else if (
            result.data &&
            typeof result.data === 'object'
          ) {
            const nested = result.data as Record<string, unknown>;

            if (Array.isArray(nested.sales)) {
              sales = nested.sales as SaleApi[];
            }
          }
        }

        const mappedInvoices: Invoice[] = sales.map((sale) => {
          const rawStatus = String(sale.status ?? '').toUpperCase();

          let status: InvoiceStatus = 'Pending';

          if (['COMPLETED', 'PAID'].includes(rawStatus)) {
            status = 'Paid';
          } else if (rawStatus === 'OVERDUE') {
            status = 'Overdue';
          }

          const rawAmount = Number(
            sale.totalAmount ?? sale.subtotal ?? 0,
          );

          return {
            id: sale.invoiceNumber || sale.id,
            customer: t('Not recorded', 'غير مسجل'),
            email: '',
            issueDate: sale.createdAt
              ? String(sale.createdAt).slice(0, 10)
              : '',
            dueDate: '',
            amount: Number.isFinite(rawAmount) ? rawAmount : 0,
            status,
          };
        });

        if (!controller.signal.aborted) {
          setInvoices(mappedInvoices);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'AbortError'
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          const message =
            error instanceof Error &&
            error.message === 'SESSION_EXPIRED'
              ? t(
                  'Your session has expired. Please sign in again.',
                  'انتهت الجلسة، يرجى تسجيل الدخول مجددًا.',
                )
              : error instanceof Error &&
                  error.message === 'INVALID_ORGANIZATION'
                ? t(
                    'Your saved organization is invalid. Please sign in again.',
                    'بيانات المؤسسة المحفوظة غير صحيحة، يرجى تسجيل الدخول مجددًا.',
                  )
                : t(
                    'Could not load invoices. Please check the backend.',
                    'تعذّر تحميل الفواتير. تحقق من الـ Backend.',
                  );

          setApiError(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadInvoices();

    return () => controller.abort();
  }, [isArabic]);

  const stats = useMemo(
    () => ({
      total: invoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      ),
      paid: invoices
        .filter((invoice) => invoice.status === 'Paid')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      pending: invoices
        .filter((invoice) => invoice.status === 'Pending')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      overdue: invoices
        .filter((invoice) => invoice.status === 'Overdue')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    }),
    [invoices],
  );

  const filteredInvoices = invoices.filter((invoice) => {
    const term = search.trim().toLowerCase();

    const matchesSearch =
      invoice.id.toLowerCase().includes(term) ||
      invoice.customer.toLowerCase().includes(term) ||
      invoice.email.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'All' ||
      invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function statusLabel(status: InvoiceStatus) {
    switch (status) {
      case 'Paid':
        return t('Paid', 'مدفوعة');
      case 'Pending':
        return t('Pending', 'قيد الانتظار');
      case 'Overdue':
        return t('Overdue', 'متأخرة');
    }
  }

  function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(
      t(
        'Invoice creation is not available yet because the backend does not have a dedicated invoice endpoint.',
        'إنشاء الفواتير غير متاح حاليًا لعدم وجود endpoint مخصص لها في الـ Backend.',
      ),
    );
  }

  function exportInvoices() {
    const header = [
      'Invoice',
      'Customer',
      'Email',
      'Issue Date',
      'Due Date',
      'Amount (JOD)',
      'Status',
    ];

    const rows = filteredInvoices.map((invoice) => [
      invoice.id,
      invoice.customer,
      invoice.email,
      invoice.issueDate,
      invoice.dueDate,
      invoice.amount.toFixed(2),
      invoice.status,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value).replace(/"/g, '""')}"`,
          )
          .join(','),
      )
      .join('\n');

    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'nexa-invoices.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="invoices-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="invoices-header">
        <div>
          <div className="invoices-breadcrumb">
            {t('Workspace', 'مساحة العمل')} <span>/</span>{' '}
            {t('Invoices', 'الفواتير')}
          </div>

          <h1>{t('Invoices', 'الفواتير')}</h1>

          <p>
            {t(
              'Organize invoices and monitor payment status.',
              'نظّم الفواتير وتابع حالة المدفوعات.',
            )}
          </p>
        </div>

        <button
          className="invoice-primary-btn"
          type="button"
          onClick={() => {
            setFormError('');
            setShowCreateForm((current) => !current);
          }}
        >
          <span>+</span> {t('Create invoice', 'إنشاء فاتورة')}
        </button>
      </header>

      <section className="invoice-stats">
        <article className="invoice-stat-card">
          <div className="invoice-stat-top">
            <span>{t('Total invoiced', 'إجمالي الفواتير')}</span>
            <span className="invoice-stat-icon purple">$</span>
          </div>

          <strong>{currency(stats.total, isArabic)}</strong>
          <small>{t('Across all invoices', 'إجمالي جميع الفواتير')}</small>
        </article>

        <article className="invoice-stat-card">
          <div className="invoice-stat-top">
            <span>{t('Paid', 'مدفوعة')}</span>
            <span className="invoice-stat-icon green">✓</span>
          </div>

          <strong>{currency(stats.paid, isArabic)}</strong>
          <small className="invoice-positive">
            {t('Successfully collected', 'تم تحصيلها بنجاح')}
          </small>
        </article>

        <article className="invoice-stat-card">
          <div className="invoice-stat-top">
            <span>{t('Pending', 'قيد الانتظار')}</span>
            <span className="invoice-stat-icon amber">◷</span>
          </div>

          <strong>{currency(stats.pending, isArabic)}</strong>
          <small>{t('Awaiting payment', 'بانتظار الدفع')}</small>
        </article>

        <article className="invoice-stat-card">
          <div className="invoice-stat-top">
            <span>{t('Overdue', 'متأخرة')}</span>
            <span className="invoice-stat-icon red">!</span>
          </div>

          <strong>{currency(stats.overdue, isArabic)}</strong>
          <small className="invoice-negative">
            {t('Payment past due', 'تجاوزت موعد الاستحقاق')}
          </small>
        </article>
      </section>

      {showCreateForm && (
        <section className="invoice-create-panel">
          <div className="invoice-panel-heading">
            <div>
              <h2>{t('Create invoice', 'إنشاء فاتورة')}</h2>
              <p>
                {t(
                  'Add an invoice to your workspace.',
                  'أضف فاتورة إلى مساحة العمل.',
                )}
              </p>
            </div>

            <button
              className="invoice-close-btn"
              type="button"
              onClick={() => setShowCreateForm(false)}
              aria-label={t('Close form', 'إغلاق النموذج')}
            >
              ×
            </button>
          </div>

          <form
            className="invoice-create-form"
            onSubmit={handleCreateInvoice}
          >
            <label>
              {t('Customer name', 'اسم العميل')}
              <input
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                placeholder={t(
                  'e.g. Bright Solutions',
                  'مثال: Bright Solutions',
                )}
                required
              />
            </label>

            <label>
              {t('Customer email', 'البريد الإلكتروني للعميل')}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="billing@example.com"
                required
              />
            </label>

            <label>
              {t('Amount (JOD)', 'المبلغ (دينار أردني)')}
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <label>
              {t('Due date', 'تاريخ الاستحقاق')}
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </label>

            {formError && (
              <p className="invoice-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="invoice-form-actions">
              <button
                type="button"
                className="invoice-secondary-btn"
                onClick={() => setShowCreateForm(false)}
              >
                {t('Cancel', 'إلغاء')}
              </button>

              <button
                type="submit"
                className="invoice-primary-btn"
              >
                {t('Create invoice', 'إنشاء فاتورة')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="invoice-table-card">
        <div className="invoice-table-heading">
          <div>
            <h2>{t('All invoices', 'جميع الفواتير')}</h2>
            <p>
              {t(
                'View and manage your customer invoices.',
                'اعرض فواتير العملاء وأدرها.',
              )}
            </p>
          </div>

          <button
            className="invoice-secondary-btn"
            type="button"
            onClick={exportInvoices}
            disabled={loading || Boolean(apiError)}
          >
            <span>↓</span> {t('Export CSV', 'تصدير CSV')}
          </button>
        </div>

        <div className="invoice-toolbar">
          <div className="invoice-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search invoices...', 'ابحث في الفواتير...')}
              aria-label={t('Search invoices', 'البحث في الفواتير')}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={t('Filter by status', 'تصفية حسب الحالة')}
          >
            <option value="All">{t('All statuses', 'جميع الحالات')}</option>
            <option value="Paid">{t('Paid', 'مدفوعة')}</option>
            <option value="Pending">{t('Pending', 'قيد الانتظار')}</option>
            <option value="Overdue">{t('Overdue', 'متأخرة')}</option>
          </select>
        </div>

        <div className="invoice-table-scroll">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>{t('INVOICE', 'رقم الفاتورة')}</th>
                <th>{t('CUSTOMER', 'العميل')}</th>
                <th>{t('ISSUE DATE', 'تاريخ الإصدار')}</th>
                <th>{t('DUE DATE', 'تاريخ الاستحقاق')}</th>
                <th>{t('AMOUNT', 'المبلغ')}</th>
                <th>{t('STATUS', 'الحالة')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="invoice-empty-state">
                      {t('Loading invoices...', 'جارٍ تحميل الفواتير...')}
                    </div>
                  </td>
                </tr>
              ) : apiError ? (
                <tr>
                  <td colSpan={6}>
                    <div className="invoice-empty-state" role="alert">
                      <h3>
                        {t(
                          'Unable to load invoices',
                          'تعذّر تحميل الفواتير',
                        )}
                      </h3>
                      <p>{apiError}</p>
                      <button
                        type="button"
                        className="invoice-secondary-btn"
                        onClick={() => window.location.reload()}
                      >
                        {t('Reload page', 'إعادة تحميل الصفحة')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <span className="invoice-id">{invoice.id}</span>
                    </td>

                    <td>
                      <div className="invoice-customer">
                        <span className="invoice-avatar">
                          {invoice.customer.charAt(0).toUpperCase()}
                        </span>

                        <div>
                          <strong>{invoice.customer}</strong>
                          {invoice.email && <small>{invoice.email}</small>}
                        </div>
                      </div>
                    </td>

                    <td>
                      {invoice.issueDate
                        ? formatDate(invoice.issueDate, isArabic)
                        : '—'}
                    </td>

                    <td>
                      {invoice.dueDate
                        ? formatDate(invoice.dueDate, isArabic)
                        : '—'}
                    </td>

                    <td className="invoice-amount">
                      {currency(invoice.amount, isArabic)}
                    </td>

                    <td>
                      <span
                        className={`invoice-status ${invoice.status.toLowerCase()}`}
                      >
                        <span className="invoice-status-dot" />
                        {statusLabel(invoice.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && !apiError && filteredInvoices.length === 0 && (
            <div className="invoice-empty-state">
              <span>⌕</span>
              <h3>
                {invoices.length === 0
                  ? t('No invoices yet', 'لا توجد فواتير حتى الآن')
                  : t('No invoices found', 'لم يتم العثور على فواتير')}
              </h3>
              <p>
                {invoices.length === 0
                  ? t(
                      'Sales records will appear here when available.',
                      'ستظهر سجلات المبيعات هنا عند توفرها.',
                    )
                  : t(
                      'Try another search or change the status filter.',
                      'جرّب عبارة بحث أخرى أو غيّر تصفية الحالة.',
                    )}
              </p>
            </div>
          )}
        </div>

        <footer className="invoice-table-footer">
          <span>
            {t('Showing', 'عرض')} {loading ? 0 : filteredInvoices.length}{' '}
            {t('of', 'من')} {invoices.length} {t('invoices', 'فاتورة')}
          </span>

          <span className="invoice-demo-note">
            {t(
              'Connected to live sales data',
              'مرتبط ببيانات المبيعات الفعلية',
            )}
          </span>
        </footer>
      </section>
    </div>
  );
}
