
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import './Customers.css';

type CustomerStatus = 'Active' | 'Inactive';
type ApiCustomerStatus = 'ACTIVE' | 'INACTIVE';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  joinedAt: string;
  status: CustomerStatus;
}

interface ApiCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ApiCustomerStatus;
  createdAt: string;
  updatedAt: string;
}

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: CustomerStatus;
}

interface Organization {
  id: string;
  name?: string;
  slug?: string;
  role?: string;
}

const API_URL = 'http://localhost:3000';

const emptyForm: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  company: '',
  status: 'Active',
};

function mapCustomer(customer: ApiCustomer): Customer {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    joinedAt: customer.createdAt,
    status: customer.status === 'ACTIVE' ? 'Active' : 'Inactive',
  };
}

function getApiStatus(status: CustomerStatus): ApiCustomerStatus {
  return status === 'Active' ? 'ACTIVE' : 'INACTIVE';
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const message = data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  } catch {
    // The server may return a non-JSON response.
  }

  return `Request failed (${response.status})`;
}

export default function Customers() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const formatDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    return parsedDate.toLocaleDateString(
      isArabic ? 'ar-JO' : 'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      },
    );
  };

  const formatNumber = (number: number) =>
    number.toLocaleString(isArabic ? 'ar-JO' : 'en-US');

  const statusLabel = (status: CustomerStatus) =>
    status === 'Active'
      ? t('Active', 'نشط')
      : t('Inactive', 'غير نشط');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const organization = useMemo<Organization | null>(() => {
    try {
      const raw = localStorage.getItem('nexa_organization');

      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('id' in parsed) ||
        typeof parsed.id !== 'string' ||
        !parsed.id
      ) {
        return null;
      }

      return parsed as Organization;
    } catch {
      return null;
    }
  }, []);

  const token = localStorage.getItem('nexa_token');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setPageError('');

    if (!token || !organization?.id) {
      setCustomers([]);
      setPageError(
        t(
          'Your session or organization is missing. Please sign in again.',
          'بيانات الجلسة أو المؤسسة غير موجودة. يرجى تسجيل الدخول مجددًا.',
        ),
      );
      setLoading(false);
      return;
    }

    try {
      const query = new URLSearchParams({
        organizationId: organization.id,
      });

      const response = await fetch(
        `${API_URL}/customers?${query.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (!Array.isArray(data.customers)) {
        throw new Error(
          t(
            'The server returned an unexpected response.',
            'استجابة الخادم غير متوقعة.',
          ),
        );
      }

      setCustomers((data.customers as ApiCustomer[]).map(mapCustomer));
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t('Unable to load customers.', 'تعذر تحميل العملاء.'),
      );
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [organization, token, refreshKey, isArabic]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    const active = customers.filter(
      (customer) => customer.status === 'Active',
    ).length;

    const newThisMonth = customers.filter((customer) => {
      const joinedDate = new Date(customer.joinedAt);

      return (
        !Number.isNaN(joinedDate.getTime()) &&
        joinedDate >= monthStart &&
        joinedDate <= now
      );
    }).length;

    return {
      total: customers.length,
      active,
      newThisMonth,
    };
  }, [customers]);

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();

    const matchesSearch =
      customer.id.toLowerCase().includes(term) ||
      customer.name.toLowerCase().includes(term) ||
      customer.email.toLowerCase().includes(term) ||
      customer.phone.toLowerCase().includes(term) ||
      customer.company.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'All' || customer.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      status: customer.status,
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const company = form.company.trim();

    if (!name || !email || !phone || !company) {
      setFormError(
        t('Please complete all fields.', 'يرجى تعبئة جميع الحقول.'),
      );
      return;
    }

    const duplicateEmail = customers.some(
      (customer) =>
        customer.email.toLowerCase() === email.toLowerCase() &&
        customer.id !== editingId,
    );

    if (duplicateEmail) {
      setFormError(
        t(
          'A customer with this email already exists.',
          'يوجد عميل مسجل باستخدام هذا البريد الإلكتروني بالفعل.',
        ),
      );
      return;
    }

    if (!token || !organization?.id) {
      setFormError(
        t(
          'Please sign in again and select your organization.',
          'يرجى تسجيل الدخول مجددًا واختيار مؤسستك.',
        ),
      );
      return;
    }

    setSaving(true);

    try {
      const query = new URLSearchParams({
        organizationId: organization.id,
      });

      const isEditing = editingId !== null;

      const url = isEditing
        ? `${API_URL}/customers/${encodeURIComponent(editingId!)}?${query.toString()}`
        : `${API_URL}/customers?${query.toString()}`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          company,
          status: getApiStatus(form.status),
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      setPageError('');
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : t('Unable to save the customer.', 'تعذر حفظ بيانات العميل.'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(
      t(
        `Are you sure you want to delete ${customer.name}?`,
        `هل أنت متأكد من حذف العميل ${customer.name}؟`,
      ),
    );

    if (!confirmed) return;

    if (!token || !organization?.id) {
      setPageError(
        t('Please sign in again.', 'يرجى تسجيل الدخول مجددًا.'),
      );
      return;
    }

    setDeletingId(customer.id);
    setPageError('');

    try {
      const query = new URLSearchParams({
        organizationId: organization.id,
      });

      const response = await fetch(
        `${API_URL}/customers/${encodeURIComponent(customer.id)}?${query.toString()}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setCustomers((current) =>
        current.filter((item) => item.id !== customer.id),
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : t('Unable to delete the customer.', 'تعذر حذف العميل.'),
      );
    } finally {
      setDeletingId(null);
    }
  }

  function exportCustomers() {
    const header = [
      t('Customer ID', 'رقم العميل'),
      t('Name', 'الاسم'),
      t('Email', 'البريد الإلكتروني'),
      t('Phone', 'رقم الهاتف'),
      t('Company', 'الشركة'),
      t('Join Date', 'تاريخ الانضمام'),
      t('Status', 'الحالة'),
    ];

    const rows = filteredCustomers.map((customer) => [
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.company,
      customer.joinedAt,
      statusLabel(customer.status),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'nexa-customers.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="customers-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="customers-heading">
        <div>
          <div className="customers-eyebrow">
            {t('WORKSPACE / CUSTOMERS', 'مساحة العمل / العملاء')}
          </div>
          <h1>{t('Customers', 'العملاء')}</h1>
          <p>
            {t(
              'Manage customer relationships and track purchase activity.',
              'أدر علاقات العملاء وتابع نشاط مشترياتهم.',
            )}
          </p>
        </div>

        <button
          type="button"
          className="customers-primary-btn"
          onClick={openCreateForm}
        >
          <span>+</span> {t('Add customer', 'إضافة عميل')}
        </button>
      </header>

      {pageError && (
        <div className="customers-form-error" role="alert">
          {pageError}
          <button
            type="button"
            className="customers-secondary-btn"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            {t('Retry', 'إعادة المحاولة')}
          </button>
        </div>
      )}

      <section className="customers-metrics">
        <article className="customers-metric">
          <div className="customers-metric-top">
            <span>{t('Total customers', 'إجمالي العملاء')}</span>
            <span className="customers-metric-icon">♙</span>
          </div>
          <strong>{loading ? '...' : formatNumber(stats.total)}</strong>
          <small>{t('All registered customers', 'جميع العملاء المسجلين')}</small>
        </article>

        <article className="customers-metric">
          <div className="customers-metric-top">
            <span>{t('Active customers', 'العملاء النشطون')}</span>
            <span className="customers-metric-icon">✓</span>
          </div>
          <strong>{loading ? '...' : formatNumber(stats.active)}</strong>
          <small className="customers-positive">
            {t('Currently active', 'النشطون حاليًا')}
          </small>
        </article>

        <article className="customers-metric">
          <div className="customers-metric-top">
            <span>{t('New this month', 'الجدد هذا الشهر')}</span>
            <span className="customers-metric-icon warning">↗</span>
          </div>
          <strong>{loading ? '...' : formatNumber(stats.newThisMonth)}</strong>
          <small>
            {t(
              'Joined during the current month',
              'انضموا خلال الشهر الحالي',
            )}
          </small>
        </article>

        <article className="customers-metric">
          <div className="customers-metric-top">
            <span>{t('Total purchases', 'إجمالي المشتريات')}</span>
            <span className="customers-metric-icon">＄</span>
          </div>
          <strong className="customers-value">—</strong>
          <small>
            {t(
              'Not available until sales are linked to customers',
              'غير متاح حتى ربط المبيعات بالعملاء',
            )}
          </small>
        </article>
      </section>

      {showForm && (
        <section className="customers-form-panel">
          <div className="customers-panel-heading">
            <div>
              <h2>
                {editingId
                  ? t('Edit customer', 'تعديل العميل')
                  : t('Add customer', 'إضافة عميل')}
              </h2>
              <p>
                {editingId
                  ? t(
                      'Update the customer details below.',
                      'حدّث بيانات العميل من خلال الحقول التالية.',
                    )
                  : t(
                      'Enter the details for your new customer.',
                      'أدخل بيانات العميل الجديد.',
                    )}
              </p>
            </div>

            <button
              type="button"
              className="customers-close-btn"
              onClick={closeForm}
              aria-label={t('Close customer form', 'إغلاق نموذج العميل')}
            >
              ×
            </button>
          </div>

          <form className="customers-form" onSubmit={handleSubmit}>
            <label className="customers-field">
              <span>{t('Customer name', 'اسم العميل')} <b>*</b></span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder={t('e.g. Omar Haddad', 'مثال: عمر حداد')}
                autoComplete="name"
                required
              />
            </label>

            <label className="customers-field">
              <span>{t('Email address', 'البريد الإلكتروني')} <b>*</b></span>
              <input
                type="email"
                dir="auto"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder="customer@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="customers-field">
              <span>{t('Phone number', 'رقم الهاتف')} <b>*</b></span>
              <input
                type="tel"
                dir="ltr"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="+962 7X XXX XXXX"
                autoComplete="tel"
                required
              />
            </label>

            <label className="customers-field">
              <span>{t('Company', 'الشركة')} <b>*</b></span>
              <input
                value={form.company}
                onChange={(event) =>
                  setForm({ ...form, company: event.target.value })
                }
                placeholder={t(
                  'Company or business name',
                  'اسم الشركة أو المؤسسة',
                )}
                autoComplete="organization"
                required
              />
            </label>

            <label className="customers-field">
              <span>{t('Customer status', 'حالة العميل')}</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as CustomerStatus,
                  })
                }
              >
                <option value="Active">{t('Active', 'نشط')}</option>
                <option value="Inactive">{t('Inactive', 'غير نشط')}</option>
              </select>
            </label>

            {formError && (
              <p className="customers-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="customers-form-actions">
              <button
                type="button"
                className="customers-secondary-btn"
                onClick={closeForm}
                disabled={saving}
              >
                {t('Cancel', 'إلغاء')}
              </button>

              <button
                type="submit"
                className="customers-primary-btn"
                disabled={saving}
              >
                {saving
                  ? t('Saving...', 'جارٍ الحفظ...')
                  : editingId
                    ? t('Save changes', 'حفظ التعديلات')
                    : t('Add customer', 'إضافة عميل')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="customers-panel">
        <div className="customers-toolbar">
          <div>
            <h2>{t('All customers', 'جميع العملاء')}</h2>
            <p>
              {t(
                'View, search and manage your customer directory.',
                'استعرض قائمة العملاء وابحث فيها وأدر بياناتهم.',
              )}
            </p>
          </div>

          <button
            type="button"
            className="customers-secondary-btn"
            onClick={exportCustomers}
            disabled={loading || customers.length === 0}
          >
            <span>↓</span> {t('Export CSV', 'تصدير CSV')}
          </button>
        </div>

        <div className="customers-filters">
          <div className="customers-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                'Search name, email, company...',
                'ابحث بالاسم أو البريد أو الشركة...',
              )}
              aria-label={t('Search customers', 'البحث عن العملاء')}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('Clear search', 'مسح البحث')}
              >
                ×
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={t(
              'Filter customers by status',
              'تصفية العملاء حسب الحالة',
            )}
          >
            <option value="All">{t('All statuses', 'جميع الحالات')}</option>
            <option value="Active">{t('Active', 'نشط')}</option>
            <option value="Inactive">{t('Inactive', 'غير نشط')}</option>
          </select>
        </div>

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>{t('CUSTOMER', 'العميل')}</th>
                <th>{t('CUSTOMER ID', 'رقم العميل')}</th>
                <th>{t('PHONE', 'الهاتف')}</th>
                <th>{t('JOINED DATE', 'تاريخ الانضمام')}</th>
                <th>{t('TOTAL SPENT', 'إجمالي الإنفاق')}</th>
                <th>{t('STATUS', 'الحالة')}</th>
                <th>{t('ACTIONS', 'الإجراءات')}</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customers-name-cell">
                        <div className="customers-avatar">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{customer.name}</strong>
                          <small dir="auto">{customer.email}</small>
                          <small className="customers-company">
                            {customer.company}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="customers-id">
                        {customer.id.slice(0, 8)}
                      </span>
                    </td>

                    <td dir="ltr">{customer.phone}</td>

                    <td>{formatDate(customer.joinedAt)}</td>

                    <td className="customers-spent">—</td>

                    <td>
                      <span
                        className={`customers-status ${customer.status.toLowerCase()}`}
                      >
                        <span />
                        {statusLabel(customer.status)}
                      </span>
                    </td>

                    <td>
                      <div className="customers-row-actions">
                        <button
                          type="button"
                          className="customers-icon-btn"
                          onClick={() => openEditForm(customer)}
                          aria-label={t(
                            `Edit ${customer.name}`,
                            `تعديل بيانات ${customer.name}`,
                          )}
                          title={t('Edit customer', 'تعديل العميل')}
                        >
                          ✎
                        </button>

                        <button
                          type="button"
                          className="customers-icon-btn delete"
                          onClick={() => void handleDelete(customer)}
                          disabled={deletingId === customer.id}
                          aria-label={t(
                            `Delete ${customer.name}`,
                            `حذف ${customer.name}`,
                          )}
                          title={t('Delete customer', 'حذف العميل')}
                        >
                          {deletingId === customer.id ? '…' : '×'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {loading && (
            <div className="customers-empty">
              <h3>{t('Loading customers...', 'جارٍ تحميل العملاء...')}</h3>
            </div>
          )}

          {!loading && !pageError && filteredCustomers.length === 0 && (
            <div className="customers-empty">
              <span>⌕</span>
              <h3>
                {customers.length === 0
                  ? t('No customers yet', 'لا يوجد عملاء حتى الآن')
                  : t('No customers found', 'لم يتم العثور على عملاء')}
              </h3>
              <p>
                {customers.length === 0
                  ? t(
                      'Add your first customer to get started.',
                      'أضف أول عميل للبدء.',
                    )
                  : t(
                      'Try a different search or adjust the status filter.',
                      'جرّب البحث بكلمات مختلفة أو غيّر فلتر الحالة.',
                    )}
              </p>

              {search && (
                <button
                  type="button"
                  className="customers-secondary-btn"
                  onClick={() => setSearch('')}
                >
                  {t('Clear search', 'مسح البحث')}
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="customers-footer">
          <span>
            {t('Showing', 'عرض')} {formatNumber(filteredCustomers.length)}{' '}
            {t('of', 'من')} {formatNumber(customers.length)}{' '}
            {t('customers', 'عميل')}
          </span>
          <span className="customers-demo-note">
            {t(
              'Live data · Connected to API',
              'بيانات فعلية · متصلة بواجهة API',
            )}
          </span>
        </footer>
      </section>
    </div>
  );
}
