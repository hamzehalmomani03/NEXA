
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Sales.css';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

function getOrganizationId(): string {
  const savedOrganization = localStorage.getItem('nexa_organization');

  if (!savedOrganization) {
    throw new Error('No organization selected. Please sign in again.');
  }

  try {
    const organization = JSON.parse(savedOrganization) as {
      id?: string | number;
    };

    if (
      organization.id === undefined ||
      organization.id === null ||
      String(organization.id).trim() === ''
    ) {
      throw new Error(
        'Selected organization is invalid. Please sign in again.',
      );
    }

    return String(organization.id);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Saved organization data is invalid. Please sign in again.',
      );
    }

    throw error;
  }
}

type Product = {
  id: string;
  name: string;
  sku?: string;
  price: string | number;
  stockQuantity: number;
  status?: string;
};

type SaleItem = {
  id?: string;
  productId?: string;
  quantity: number;
  unitPrice?: string | number;
  price?: string | number;
  lineTotal?: string | number;
  totalPrice?: string | number;
  product?: {
    id?: string;
    name?: string;
    sku?: string;
  };
};

type Sale = {
  id: string;
  invoiceNumber?: string;
  subtotal?: string | number;
  totalAmount?: string | number;
  status?: string;
  createdAt?: string;
  note?: string | null;
  items?: SaleItem[];
};

type CartItem = {
  productId: string;
  quantity: number;
};

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('nexa_token');

  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || data.error || `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data as T;
}

function unwrapList<T>(response: unknown, keys: string[]): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (response && typeof response === 'object') {
    const result = response as Record<string, unknown>;

    for (const key of keys) {
      if (Array.isArray(result[key])) {
        return result[key] as T[];
      }
    }

    if (result.data && typeof result.data === 'object') {
      return unwrapList<T>(result.data, keys);
    }
  }

  return [];
}

function unwrapSale(response: unknown): Sale {
  if (response && typeof response === 'object') {
    const result = response as Record<string, unknown>;

    if (result.sale && typeof result.sale === 'object') {
      return result.sale as Sale;
    }

    if (result.data && typeof result.data === 'object') {
      return unwrapSale(result.data);
    }

    return result as unknown as Sale;
  }

  throw new Error('Could not read the sale response.');
}

function money(
  value: string | number | undefined,
  isArabic: boolean,
): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat(isArabic ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | undefined, isArabic: boolean): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(isArabic ? 'ar-JO' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSaleTotal(sale: Sale): number {
  return Number(sale.totalAmount ?? sale.subtotal ?? 0);
}

function getItemName(item: SaleItem, isArabic: boolean): string {
  return item.product?.name || (isArabic ? 'منتج' : 'Product');
}

function Sales() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');

  const loadProducts = useCallback(async () => {
    const organizationId = getOrganizationId();

    const response = await apiRequest<unknown>(
      `/products?organizationId=${encodeURIComponent(organizationId)}`,
    );

    setProducts(unwrapList<Product>(response, ['products']));
  }, []);

  const loadSales = useCallback(async () => {
    const organizationId = getOrganizationId();

    const response = await apiRequest<unknown>(
      `/sales?organizationId=${encodeURIComponent(organizationId)}`,
    );

    setSales(unwrapList<Sale>(response, ['sales']));
  }, []);

  const refreshData = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      await Promise.all([loadSales(), loadProducts()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load sales data.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadProducts, loadSales]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const activeProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (!product.status || product.status === 'ACTIVE') &&
          Number(product.stockQuantity) > 0,
      ),
    [products],
  );

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return sales;

    return sales.filter((sale) =>
      [sale.invoiceNumber, sale.id, sale.status, sale.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [sales, search]);

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + getSaleTotal(sale),
    0,
  );

  const completedSales = sales.filter(
    (sale) => sale.status?.toUpperCase() === 'COMPLETED',
  );

  const totalUnitsSold = sales.reduce(
    (sum, sale) =>
      sum +
      (sale.items || []).reduce(
        (itemSum, item) => itemSum + Number(item.quantity || 0),
        0,
      ),
    0,
  );

  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);

    return sum + Number(product?.price || 0) * item.quantity;
  }, 0);

  function resetForm() {
    setCart([]);
    setProductId('');
    setQuantity(1);
    setNote('');
  }

  function addToCart() {
    setError('');
    setSuccess('');

    if (!productId) {
      setError(t('Please select a product first.', 'يرجى اختيار منتج أولاً.'));
      return;
    }

    const product = activeProducts.find((entry) => entry.id === productId);

    if (!product) {
      setError(
        t(
          'This product is unavailable or out of stock.',
          'هذا المنتج غير متاح أو نفدت كميته من المخزون.',
        ),
      );
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError(
        t(
          'Quantity must be a positive whole number.',
          'يجب أن تكون الكمية عدداً صحيحاً موجباً.',
        ),
      );
      return;
    }

    const existing = cart.find((item) => item.productId === productId);
    const newQuantity = (existing?.quantity || 0) + quantity;

    if (newQuantity > Number(product.stockQuantity)) {
      setError(
        t(
          `Only ${product.stockQuantity} units are available for ${product.name}.`,
          `المتوفر من ${product.name} هو ${product.stockQuantity} قطعة فقط.`,
        ),
      );
      return;
    }

    setCart((current) => {
      const found = current.find((item) => item.productId === productId);

      if (found) {
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [...current, { productId, quantity }];
    });

    setProductId('');
    setQuantity(1);
  }

  function changeCartQuantity(id: string, nextQuantity: number) {
    const product = products.find((entry) => entry.id === id);

    if (!product) return;

    if (
      !Number.isInteger(nextQuantity) ||
      nextQuantity < 1 ||
      nextQuantity > Number(product.stockQuantity)
    ) {
      setError(
        t(
          `Enter a quantity between 1 and ${product.stockQuantity}.`,
          `أدخل كمية بين 1 و${product.stockQuantity}.`,
        ),
      );
      return;
    }

    setError('');

    setCart((current) =>
      current.map((item) =>
        item.productId === id
          ? { ...item, quantity: nextQuantity }
          : item,
      ),
    );
  }

  async function createSale() {
    setError('');
    setSuccess('');

    if (cart.length === 0) {
      setError(
        t(
          'Add at least one product to the sale.',
          'أضف منتجاً واحداً على الأقل إلى عملية البيع.',
        ),
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiRequest<unknown>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: getOrganizationId(),
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });

      const createdSale = unwrapSale(response);

      setCreateOpen(false);
      resetForm();

      setSuccess(
        createdSale.invoiceNumber
          ? t(
              `Sale created successfully: ${createdSale.invoiceNumber}`,
              `تم إنشاء عملية البيع بنجاح: ${createdSale.invoiceNumber}`,
            )
          : t('Sale created successfully.', 'تم إنشاء عملية البيع بنجاح.'),
      );

      await Promise.all([loadSales(), loadProducts()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create sale.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function viewSale(sale: Sale) {
    setSelectedSale(sale);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setError('');

    try {
      const organizationId = getOrganizationId();

      const response = await apiRequest<unknown>(
        `/sales/${encodeURIComponent(sale.id)}?organizationId=${encodeURIComponent(organizationId)}`,
      );

      setSelectedSale(unwrapSale(response));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load sale details.',
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function statusClass(status?: string) {
    const normalized = (status || 'other').toLowerCase();

    if (normalized === 'completed') return 'completed';
    if (normalized === 'pending') return 'pending';
    if (normalized === 'cancelled' || normalized === 'canceled') {
      return 'cancelled';
    }

    return 'other';
  }

  function statusLabel(status?: string) {
    const normalized = (status || '').toUpperCase();

    if (normalized === 'COMPLETED') {
      return t('Completed', 'مكتملة');
    }

    if (normalized === 'PENDING') {
      return t('Pending', 'قيد الانتظار');
    }

    if (normalized === 'CANCELLED' || normalized === 'CANCELED') {
      return t('Cancelled', 'ملغاة');
    }

    return status || t('Unknown', 'غير معروف');
  }

  return (
    <section className="sales-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="sales-heading">
        <div>
          <p className="sales-eyebrow">
            {t('BUSINESS MANAGEMENT', 'إدارة الأعمال')}
          </p>
          <h1>{t('Sales', 'المبيعات')}</h1>
          <p>
            {t(
              'Track transactions and manage your sales activity.',
              'تابع المعاملات وأدر عمليات البيع الخاصة بك.',
            )}
          </p>
        </div>

        <button
          className="sales-primary-button"
          type="button"
          onClick={() => {
            setError('');
            setSuccess('');
            setCreateOpen(true);
          }}
        >
          <span>＋</span> {t('Create sale', 'إنشاء عملية بيع')}
        </button>
      </div>

      {error && (
        <div className="sales-alert sales-alert-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError('')}
            aria-label={t('Dismiss error', 'إغلاق رسالة الخطأ')}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="sales-alert sales-alert-success" role="status">
          {success}
          <button
            type="button"
            onClick={() => setSuccess('')}
            aria-label={t('Dismiss message', 'إغلاق الرسالة')}
          >
            ×
          </button>
        </div>
      )}

      <div className="sales-metrics">
        <article className="sales-metric">
          <div className="sales-metric-top">
            <span>{t('Total revenue', 'إجمالي الإيرادات')}</span>
            <span className="sales-metric-icon">↗</span>
          </div>
          <strong className="sales-metric-value">
            {money(totalRevenue, isArabic)}
          </strong>
          <span>
            {t('Across', 'من أصل')} {sales.length}{' '}
            {t('recorded sales', 'عملية بيع مسجلة')}
          </span>
        </article>

        <article className="sales-metric">
          <div className="sales-metric-top">
            <span>{t('Total sales', 'إجمالي المبيعات')}</span>
            <span className="sales-metric-icon">▤</span>
          </div>
          <strong className="sales-metric-value">{sales.length}</strong>
          <span>
            {completedSales.length} {t('completed', 'مكتملة')}
          </span>
        </article>

        <article className="sales-metric">
          <div className="sales-metric-top">
            <span>{t('Average sale', 'متوسط قيمة البيع')}</span>
            <span className="sales-metric-icon">◈</span>
          </div>
          <strong className="sales-metric-value">
            {money(sales.length ? totalRevenue / sales.length : 0, isArabic)}
          </strong>
          <span>{t('Average transaction value', 'متوسط قيمة المعاملة')}</span>
        </article>

        <article className="sales-metric">
          <div className="sales-metric-top">
            <span>{t('Units sold', 'الوحدات المباعة')}</span>
            <span className="sales-metric-icon">▦</span>
          </div>
          <strong className="sales-metric-value">{totalUnitsSold}</strong>
          <span>
            {t('From loaded sale records', 'حسب سجلات المبيعات المحمّلة')}
          </span>
        </article>
      </div>

      <div className="sales-panel">
        <div className="sales-toolbar">
          <div>
            <h2>{t('Sales transactions', 'معاملات البيع')}</h2>
            <p>
              {t(
                'Review your recorded sales and invoices.',
                'راجع عمليات البيع والفواتير المسجلة.',
              )}
            </p>
          </div>

          <div className="sales-toolbar-actions">
            <input
              className="sales-search"
              type="search"
              placeholder={t(
                'Search invoice or status...',
                'ابحث برقم الفاتورة أو الحالة...',
              )}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t('Search sales', 'البحث في المبيعات')}
            />

            <button
              className="sales-refresh-button"
              type="button"
              onClick={() => void refreshData()}
              disabled={loading}
            >
              ↻ {t('Refresh', 'تحديث')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sales-state">
            <span className="sales-spinner" />
            <p>{t('Loading sales...', 'جارٍ تحميل المبيعات...')}</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="sales-state">
            <div className="sales-empty-icon">▤</div>
            <h3>
              {search
                ? t('No matching sales', 'لا توجد مبيعات مطابقة')
                : t('No sales yet', 'لا توجد مبيعات حتى الآن')}
            </h3>
            <p>
              {search
                ? t(
                    'Try another invoice number or status.',
                    'جرّب رقم فاتورة أو حالة أخرى.',
                  )
                : t(
                    'Create your first sale to start recording transactions.',
                    'أنشئ أول عملية بيع لبدء تسجيل المعاملات.',
                  )}
            </p>

            {!search && (
              <button
                className="sales-primary-button"
                type="button"
                onClick={() => setCreateOpen(true)}
              >
                ＋ {t('Create your first sale', 'أنشئ أول عملية بيع')}
              </button>
            )}
          </div>
        ) : (
          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>{t('INVOICE', 'الفاتورة')}</th>
                  <th>{t('DATE', 'التاريخ')}</th>
                  <th>{t('ITEMS', 'القطع')}</th>
                  <th>{t('TOTAL', 'الإجمالي')}</th>
                  <th>{t('STATUS', 'الحالة')}</th>
                  <th>{t('ACTION', 'الإجراء')}</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <div className="sales-invoice">
                        <span className="sales-invoice-icon">▤</span>
                        <div>
                          <strong>
                            {sale.invoiceNumber || `#${sale.id.slice(0, 8)}`}
                          </strong>
                          <small>{sale.id.slice(0, 8)}</small>
                        </div>
                      </div>
                    </td>

                    <td>{formatDate(sale.createdAt, isArabic)}</td>

                    <td>
                      {(sale.items || []).reduce(
                        (sum, item) => sum + Number(item.quantity || 0),
                        0,
                      )}
                    </td>

                    <td>
                      <strong>{money(getSaleTotal(sale), isArabic)}</strong>
                    </td>

                    <td>
                      <span
                        className={`sales-status ${statusClass(sale.status)}`}
                      >
                        {statusLabel(sale.status)}
                      </span>
                    </td>

                    <td>
                      <button
                        className="sales-view-button"
                        type="button"
                        onClick={() => void viewSale(sale)}
                      >
                        {t('View details', 'عرض التفاصيل')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="sales-panel-footer">
          {t('Showing', 'عرض')} {filteredSales.length}{' '}
          {t('of', 'من')} {sales.length} {t('sales', 'عملية بيع')}
        </div>
      </div>

      {createOpen && (
        <div
          className="sales-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setCreateOpen(false);
            }
          }}
        >
          <section
            className="sales-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-sale-title"
          >
            <div className="sales-modal-header">
              <div>
                <h2 id="create-sale-title">
                  {t('Create a sale', 'إنشاء عملية بيع')}
                </h2>
                <p>
                  {t(
                    'Select products and quantities for this transaction.',
                    'اختر المنتجات والكميات لهذه المعاملة.',
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => !submitting && setCreateOpen(false)}
                aria-label={t('Close create sale', 'إغلاق نافذة إنشاء البيع')}
                disabled={submitting}
              >
                ×
              </button>
            </div>

            <div className="sales-form-body">
              <div className="sales-add-product">
                <div className="sales-field">
                  <label htmlFor="sale-product">
                    {t('Product', 'المنتج')}
                  </label>
                  <select
                    id="sale-product"
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                  >
                    <option value="">
                      {t('Choose a product', 'اختر منتجاً')}
                    </option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {money(product.price, isArabic)} ·{' '}
                        {t('Stock', 'المخزون')}: {product.stockQuantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sales-field sales-quantity-field">
                  <label htmlFor="sale-quantity">
                    {t('Quantity', 'الكمية')}
                  </label>
                  <input
                    id="sale-quantity"
                    type="number"
                    min={1}
                    max={
                      activeProducts.find((product) => product.id === productId)
                        ?.stockQuantity || undefined
                    }
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(Number(event.target.value))
                    }
                  />
                </div>

                <button
                  className="sales-add-button"
                  type="button"
                  onClick={addToCart}
                >
                  {t('Add', 'إضافة')}
                </button>
              </div>

              <div className="sales-cart">
                <div className="sales-cart-heading">
                  <h3>{t('Sale items', 'منتجات البيع')}</h3>
                  <span>
                    {cart.length} {t('products', 'منتج')}
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="sales-cart-empty">
                    {t('No products added yet.', 'لم تتم إضافة أي منتجات بعد.')}
                  </div>
                ) : (
                  cart.map((item) => {
                    const product = products.find(
                      (entry) => entry.id === item.productId,
                    );

                    if (!product) return null;

                    return (
                      <div className="sales-cart-row" key={item.productId}>
                        <div className="sales-cart-product">
                          <strong>{product.name}</strong>
                          <small>
                            {money(product.price, isArabic)}{' '}
                            {t('each', 'للقطعة')}
                          </small>
                        </div>

                        <div className="sales-cart-quantity">
                          <button
                            type="button"
                            aria-label={t(
                              `Decrease ${product.name} quantity`,
                              `تقليل كمية ${product.name}`,
                            )}
                            onClick={() =>
                              changeCartQuantity(
                                item.productId,
                                item.quantity - 1,
                              )
                            }
                            disabled={item.quantity <= 1}
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            aria-label={t(
                              `Increase ${product.name} quantity`,
                              `زيادة كمية ${product.name}`,
                            )}
                            onClick={() =>
                              changeCartQuantity(
                                item.productId,
                                item.quantity + 1,
                              )
                            }
                            disabled={
                              item.quantity >= Number(product.stockQuantity)
                            }
                          >
                            +
                          </button>
                        </div>

                        <strong className="sales-cart-line-total">
                          {money(
                            Number(product.price) * item.quantity,
                            isArabic,
                          )}
                        </strong>

                        <button
                          className="sales-cart-remove"
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.filter(
                                (entry) => entry.productId !== item.productId,
                              ),
                            )
                          }
                          aria-label={t(
                            `Remove ${product.name}`,
                            `إزالة ${product.name}`,
                          )}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="sales-field">
                <label htmlFor="sale-note">
                  {t('Note (optional)', 'ملاحظة (اختياري)')}
                </label>
                <textarea
                  id="sale-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t(
                    'Add a note to this sale...',
                    'أضف ملاحظة لعملية البيع...',
                  )}
                  rows={3}
                />
              </div>

              <div className="sales-total-row">
                <span>{t('Estimated total', 'الإجمالي التقديري')}</span>
                <strong>{money(cartTotal, isArabic)}</strong>
              </div>

              <p className="sales-note">
                {t(
                  'The backend calculates the final amount using the stored product prices and updates stock when the sale succeeds.',
                  'يحسب النظام المبلغ النهائي باستخدام أسعار المنتجات المحفوظة، ويحدّث المخزون عند نجاح عملية البيع.',
                )}
              </p>
            </div>

            <div className="sales-modal-footer">
              <button
                className="sales-refresh-button"
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                {t('Cancel', 'إلغاء')}
              </button>

              <button
                className="sales-primary-button"
                type="button"
                onClick={() => void createSale()}
                disabled={submitting || cart.length === 0}
              >
                {submitting
                  ? t('Creating sale...', 'جارٍ إنشاء عملية البيع...')
                  : t('Confirm sale', 'تأكيد البيع')}
              </button>
            </div>
          </section>
        </div>
      )}

      {detailsOpen && (
        <div
          className="sales-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDetailsOpen(false);
            }
          }}
        >
          <section
            className="sales-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-details-title"
          >
            <div className="sales-modal-header">
              <div>
                <h2 id="sale-details-title">
                  {t('Sale details', 'تفاصيل البيع')}
                </h2>
                <p>
                  {selectedSale?.invoiceNumber ||
                    selectedSale?.id ||
                    t('Transaction', 'المعاملة')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label={t('Close sale details', 'إغلاق تفاصيل البيع')}
              >
                ×
              </button>
            </div>

            <div className="sales-form-body">
              {detailsLoading ? (
                <div className="sales-state">
                  <span className="sales-spinner" />
                  <p>
                    {t(
                      'Loading sale details...',
                      'جارٍ تحميل تفاصيل البيع...',
                    )}
                  </p>
                </div>
              ) : selectedSale ? (
                <>
                  <div className="sales-detail-row">
                    <span>{t('Invoice', 'الفاتورة')}</span>
                    <strong>
                      {selectedSale.invoiceNumber || selectedSale.id}
                    </strong>
                  </div>

                  <div className="sales-detail-row">
                    <span>{t('Date', 'التاريخ')}</span>
                    <strong>
                      {formatDate(selectedSale.createdAt, isArabic)}
                    </strong>
                  </div>

                  <div className="sales-detail-row">
                    <span>{t('Status', 'الحالة')}</span>
                    <span
                      className={`sales-status ${statusClass(selectedSale.status)}`}
                    >
                      {statusLabel(selectedSale.status)}
                    </span>
                  </div>

                  <div className="sales-cart">
                    <div className="sales-cart-heading">
                      <h3>{t('Items', 'المنتجات')}</h3>
                    </div>

                    {selectedSale.items?.length ? (
                      selectedSale.items.map((item, index) => {
                        const price = Number(
                          item.unitPrice ?? item.price ?? 0,
                        );

                        const lineTotal = Number(
                          item.lineTotal ??
                            item.totalPrice ??
                            price * item.quantity,
                        );

                        return (
                          <div
                            className="sales-cart-row"
                            key={item.id || item.productId || index}
                          >
                            <div className="sales-cart-product">
                              <strong>{getItemName(item, isArabic)}</strong>
                              <small>
                                {money(price, isArabic)} × {item.quantity}
                              </small>
                            </div>

                            <strong className="sales-cart-line-total">
                              {money(lineTotal, isArabic)}
                            </strong>
                          </div>
                        );
                      })
                    ) : (
                      <div className="sales-cart-empty">
                        {t(
                          'No item details were returned by the API.',
                          'لم تُرجع واجهة API تفاصيل المنتجات.',
                        )}
                      </div>
                    )}
                  </div>

                  {selectedSale.note && (
                    <div className="sales-field">
                      <label>{t('Note', 'ملاحظة')}</label>
                      <p>{selectedSale.note}</p>
                    </div>
                  )}

                  <div className="sales-total-row">
                    <span>{t('Total', 'الإجمالي')}</span>
                    <strong>
                      {money(getSaleTotal(selectedSale), isArabic)}
                    </strong>
                  </div>
                </>
              ) : (
                <p>
                  {t(
                    'Sale details are unavailable.',
                    'تفاصيل البيع غير متاحة.',
                  )}
                </p>
              )}
            </div>

            <div className="sales-modal-footer">
              <button
                className="sales-refresh-button"
                type="button"
                onClick={() => setDetailsOpen(false)}
              >
                {t('Close', 'إغلاق')}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default Sales;
