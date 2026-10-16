import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Inventory.css';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  stockQuantity: number;
  lowStockAt: number;
  price?: number;
  status?: string;
};

type Movement = {
  id: string;
  type: string;
  quantity: number;
  note?: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
  };
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
  };
};

type FormMode = 'restock' | 'adjust';

function getOrganizationId(): string {
  const savedOrganization = localStorage.getItem('nexa_organization');

  if (!savedOrganization) {
    throw new Error('No organization selected. Please sign in again.');
  }

  try {
    const organization = JSON.parse(savedOrganization);

    if (
      !organization.id ||
      String(organization.id).trim() === ''
    ) {
      throw new Error('Selected organization has no valid ID.');
    }

    return String(organization.id);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Saved organization data is invalid. Please sign in again.');
    }

    throw error;
  }
}

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
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new Error('Unauthorized: please sign in again.');
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${response.status})`;

    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }

  return data as T;
}

function formatDate(value: string, isArabic: boolean) {
  return new Date(value).toLocaleString(isArabic ? 'ar-JO' : 'en-JO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function movementLabel(type: string, isArabic: boolean) {
  const labels: Record<string, { en: string; ar: string }> = {
    RESTOCK: { en: 'Restock', ar: 'إعادة تعبئة المخزون' },
    ADJUSTMENT_IN: { en: 'Stock increased', ar: 'زيادة المخزون' },
    ADJUSTMENT_OUT: { en: 'Stock decreased', ar: 'تخفيض المخزون' },
    SALE: { en: 'Sale', ar: 'بيع' },
    RETURN: { en: 'Return', ar: 'مرتجع' },
  };

  const label = labels[type];

  if (label) return isArabic ? label.ar : label.en;

  return type.replaceAll('_', ' ').toLowerCase();
}

function stockStatus(product: Product, isArabic: boolean) {
  if (product.stockQuantity <= 0) {
    return {
      label: isArabic ? 'نفد المخزون' : 'Out of stock',
      className: 'out',
    };
  }

  if (product.stockQuantity <= product.lowStockAt) {
    return {
      label: isArabic ? 'مخزون منخفض' : 'Low stock',
      className: 'low',
    };
  }

  return {
    label: isArabic ? 'متوفر بالمخزون' : 'In stock',
    className: 'healthy',
  };
}

export default function Inventory() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const [organizationId] = useState(() => getOrganizationId());

  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [activeMode, setActiveMode] = useState<FormMode | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [adjustmentType, setAdjustmentType] =
    useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadInventory = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');

    try {
      const query = `organizationId=${encodeURIComponent(organizationId)}`;

      const [productResult, lowStockResult, movementResult] =
        await Promise.all([
          apiRequest<{ products?: Product[] }>(`/products?${query}`),
          apiRequest<{ products?: Product[] }>(`/inventory/low-stock?${query}`),
          apiRequest<{ movements?: Movement[] }>(`/inventory/movements?${query}`),
        ]);

      const productList = Array.isArray(productResult.products)
        ? productResult.products
        : [];

      setProducts(productList);
      setLowStockProducts(
        Array.isArray(lowStockResult.products)
          ? lowStockResult.products
          : [],
      );
      setMovements(
        Array.isArray(movementResult.movements)
          ? movementResult.movements
          : [],
      );

      setSelectedProductId((current) => {
        if (current && productList.some((product) => product.id === current)) {
          return current;
        }

        return productList[0]?.id ?? '';
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Could not load inventory data.', 'تعذّر تحميل بيانات المخزون.'),
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.sku ?? ''].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [products, search]);

  const totalUnits = products.reduce(
    (total, product) => total + (Number(product.stockQuantity) || 0),
    0,
  );

  const openForm = (mode: FormMode) => {
    setSuccess('');
    setError('');
    setActiveMode(mode);
    setQuantity('1');
    setNote('');
    setAdjustmentType('ADJUSTMENT_IN');

    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  };

  const closeForm = () => {
    if (submitting) return;
    setActiveMode(null);
    setNote('');
    setQuantity('1');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeMode) return;

    const parsedQuantity = Number(quantity);

    if (!selectedProductId) {
      setError(t('Select a product first.', 'اختر منتجًا أولًا.'));
      return;
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setError(
        t(
          'Quantity must be a whole number greater than zero.',
          'يجب أن تكون الكمية عددًا صحيحًا أكبر من صفر.',
        ),
      );
      return;
    }

    const selectedProduct = products.find(
      (product) => product.id === selectedProductId,
    );

    if (
      activeMode === 'adjust' &&
      adjustmentType === 'ADJUSTMENT_OUT' &&
      selectedProduct &&
      parsedQuantity > selectedProduct.stockQuantity
    ) {
      setError(
        t(
          'The quantity exceeds the available stock.',
          'الكمية المطلوبة أكبر من المخزون المتوفر.',
        ),
      );
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (activeMode === 'restock') {
        await apiRequest('/inventory/restock', {
          method: 'POST',
          body: JSON.stringify({
            organizationId,
            productId: selectedProductId,
            quantity: parsedQuantity,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        });

        setSuccess(
          t('Stock replenished successfully.', 'تمت إعادة تعبئة المخزون بنجاح.'),
        );
      } else {
        await apiRequest('/inventory/adjust', {
          method: 'POST',
          body: JSON.stringify({
            organizationId,
            productId: selectedProductId,
            type: adjustmentType,
            quantity: parsedQuantity,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        });

        setSuccess(
          t('Inventory adjusted successfully.', 'تم تعديل المخزون بنجاح.'),
        );
      }

      setActiveMode(null);
      setQuantity('1');
      setNote('');
      await loadInventory(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('The inventory operation failed.', 'فشلت عملية تعديل المخزون.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="inventory-page"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <header className="inventory-heading">
        <div>
          <span className="inventory-eyebrow">
            {t('INVENTORY MANAGEMENT', 'إدارة المخزون')}
          </span>
          <h1>{t('Inventory', 'المخزون')}</h1>
          <p className="inventory-subtitle">
            {t(
              'Track stock levels, replenish products, and review inventory activity.',
              'تابع مستويات المخزون، وأعد تعبئة المنتجات، وراجع حركة المخزون.',
            )}
          </p>
        </div>

        <button
          className="inventory-refresh"
          type="button"
          onClick={() => void loadInventory()}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span>
          {t('Refresh', 'تحديث')}
        </button>
      </header>

      {error && (
        <div className="inventory-alert inventory-alert-error" role="alert">
          <span>{error}</span>
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
        <div className="inventory-alert inventory-alert-success" role="status">
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess('')}
            aria-label={t('Dismiss message', 'إغلاق الرسالة')}
          >
            ×
          </button>
        </div>
      )}

      <section className="inventory-stats">
        <article className="inventory-stat-card">
          <div className="inventory-stat-top">
            <span className="inventory-stat-icon inventory-icon-blue">▦</span>
            <span className="inventory-stat-caption">
              {t('PRODUCTS', 'المنتجات')}
            </span>
          </div>
          <strong>{loading ? '…' : products.length}</strong>
          <span className="inventory-stat-description">
            {t('Active product records', 'عدد سجلات المنتجات')}
          </span>
        </article>

        <article className="inventory-stat-card">
          <div className="inventory-stat-top">
            <span className="inventory-stat-icon inventory-icon-violet">▤</span>
            <span className="inventory-stat-caption">
              {t('TOTAL UNITS', 'إجمالي الوحدات')}
            </span>
          </div>
          <strong>
            {loading ? '…' : totalUnits.toLocaleString(isArabic ? 'ar-JO' : 'en-JO')}
          </strong>
          <span className="inventory-stat-description">
            {t('Units currently in stock', 'الوحدات المتوفرة حاليًا')}
          </span>
        </article>

        <article className="inventory-stat-card">
          <div className="inventory-stat-top">
            <span className="inventory-stat-icon inventory-icon-amber">!</span>
            <span className="inventory-stat-caption">
              {t('LOW STOCK', 'مخزون منخفض')}
            </span>
          </div>
          <strong>{loading ? '…' : lowStockProducts.length}</strong>
          <span className="inventory-stat-description">
            {t('Products needing attention', 'منتجات تحتاج إلى متابعة')}
          </span>
        </article>

        <article className="inventory-stat-card">
          <div className="inventory-stat-top">
            <span className="inventory-stat-icon inventory-icon-green">↕</span>
            <span className="inventory-stat-caption">
              {t('MOVEMENTS', 'حركات المخزون')}
            </span>
          </div>
          <strong>{loading ? '…' : movements.length}</strong>
          <span className="inventory-stat-description">
            {t('Recent recorded movements', 'أحدث الحركات المسجلة')}
          </span>
        </article>
      </section>

      <section className="inventory-panel">
        <div className="inventory-panel-heading">
          <div>
            <h2>{t('Stock overview', 'نظرة عامة على المخزون')}</h2>
            <p>
              {t(
                'Current quantities and stock thresholds for your products.',
                'الكميات الحالية وحدود تنبيه المخزون لمنتجاتك.',
              )}
            </p>
          </div>

          <div className="inventory-actions">
            <button
              className="inventory-button inventory-button-secondary"
              type="button"
              onClick={() => openForm('adjust')}
              disabled={products.length === 0}
            >
              {t('Adjust stock', 'تعديل المخزون')}
            </button>
            <button
              className="inventory-button inventory-button-primary"
              type="button"
              onClick={() => openForm('restock')}
              disabled={products.length === 0}
            >
              + {t('Restock', 'إعادة تعبئة')}
            </button>
          </div>
        </div>

        <div className="inventory-toolbar">
          <label className="inventory-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search products or SKU...', 'ابحث عن منتج أو رمز SKU...')}
              aria-label={t('Search products', 'البحث عن المنتجات')}
            />
          </label>
          <span className="inventory-result-count">
            {t(
              `${filteredProducts.length} products`,
              `${filteredProducts.length} منتج`,
            )}
          </span>
        </div>

        {loading ? (
          <div className="inventory-empty">
            {t('Loading inventory…', 'جارٍ تحميل المخزون…')}
          </div>
        ) : products.length === 0 ? (
          <div className="inventory-empty">
            <span className="inventory-empty-icon">▦</span>
            <h3>{t('No products found', 'لم يتم العثور على منتجات')}</h3>
            <p>
              {t(
                'Add products from the Products page, then manage their stock here.',
                'أضف المنتجات من صفحة المنتجات، ثم أدر مخزونها من هنا.',
              )}
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="inventory-empty">
            {t('No products match', 'لا توجد منتجات تطابق')} “{search}”.
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>{t('PRODUCT', 'المنتج')}</th>
                  <th>SKU</th>
                  <th>{t('AVAILABLE', 'المتوفر')}</th>
                  <th>{t('LOW-STOCK THRESHOLD', 'حد المخزون المنخفض')}</th>
                  <th>{t('STATUS', 'الحالة')}</th>
                  <th className="inventory-table-action-heading">
                    {t('ACTION', 'الإجراء')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const status = stockStatus(product, isArabic);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="inventory-product-cell">
                          <span className="inventory-product-avatar">
                            {product.name?.charAt(0)?.toUpperCase() || 'P'}
                          </span>
                          <span className="inventory-product-name">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="inventory-muted">{product.sku || '—'}</td>
                      <td>
                        <strong className="inventory-stock-number">
                          {product.stockQuantity}
                        </strong>
                        <span className="inventory-unit-label">
                          {' '}{t('units', 'وحدة')}
                        </span>
                      </td>
                      <td>
                        {product.lowStockAt ?? 0} {t('units', 'وحدة')}
                      </td>
                      <td>
                        <span
                          className={`inventory-status inventory-status-${status.className}`}
                        >
                          <span className="inventory-status-dot" />
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <button
                          className="inventory-row-action"
                          type="button"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            openForm('restock');
                          }}
                        >
                          {t('Restock', 'إعادة تعبئة')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="inventory-panel inventory-low-stock-panel">
        <div className="inventory-panel-heading">
          <div>
            <h2>{t('Low-stock alerts', 'تنبيهات انخفاض المخزون')}</h2>
            <p>
              {t(
                'Products at or below their configured stock threshold.',
                'المنتجات التي وصلت إلى حد المخزون المحدد أو انخفضت عنه.',
              )}
            </p>
          </div>
          <span className="inventory-count-pill">
            {lowStockProducts.length} {t('alerts', 'تنبيهات')}
          </span>
        </div>

        {loading ? (
          <div className="inventory-empty">
            {t('Checking stock levels…', 'جارٍ التحقق من مستويات المخزون…')}
          </div>
        ) : lowStockProducts.length === 0 ? (
          <div className="inventory-all-good">
            <span className="inventory-good-icon">✓</span>
            <div>
              <strong>{t('All clear', 'كل شيء على ما يرام')}</strong>
              <p>
                {t(
                  'No products are currently below their stock threshold.',
                  'لا توجد منتجات حاليًا دون حد المخزون المحدد.',
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="inventory-low-stock-list">
            {lowStockProducts.map((product) => (
              <div className="inventory-low-stock-item" key={product.id}>
                <div className="inventory-low-stock-product">
                  <span className="inventory-warning-icon">!</span>
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {product.sku || t('No SKU assigned', 'لا يوجد رمز SKU')}
                    </span>
                  </div>
                </div>
                <div className="inventory-low-stock-quantity">
                  <strong>{product.stockQuantity}</strong>
                  <span>{t('in stock', 'في المخزون')}</span>
                </div>
                <div className="inventory-low-stock-threshold">
                  <span>{t('Threshold', 'الحد')}</span>
                  <strong>{product.lowStockAt}</strong>
                </div>
                <button
                  className="inventory-button inventory-button-secondary"
                  type="button"
                  onClick={() => {
                    setSelectedProductId(product.id);
                    openForm('restock');
                  }}
                >
                  {t('Restock', 'إعادة تعبئة')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="inventory-panel">
        <div className="inventory-panel-heading">
          <div>
            <h2>{t('Recent stock movements', 'أحدث حركات المخزون')}</h2>
            <p>
              {t(
                'A log of the latest stock operations recorded by your team.',
                'سجل أحدث عمليات المخزون التي نفذها فريقك.',
              )}
            </p>
          </div>
          <span className="inventory-count-pill">
            {t('Latest', 'الأحدث')} {movements.length}
          </span>
        </div>

        {loading ? (
          <div className="inventory-empty">
            {t('Loading movements…', 'جارٍ تحميل الحركات…')}
          </div>
        ) : movements.length === 0 ? (
          <div className="inventory-empty">
            <span className="inventory-empty-icon">↕</span>
            <h3>{t('No movements yet', 'لا توجد حركات حتى الآن')}</h3>
            <p>
              {t(
                'Restocking or adjusting a product will create a movement record here.',
                'ستظهر هنا حركة جديدة عند إعادة تعبئة منتج أو تعديل مخزونه.',
              )}
            </p>
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>{t('PRODUCT', 'المنتج')}</th>
                  <th>{t('TYPE', 'النوع')}</th>
                  <th>{t('QUANTITY', 'الكمية')}</th>
                  <th>{t('NOTE', 'ملاحظة')}</th>
                  <th>{t('PERFORMED BY', 'نُفذت بواسطة')}</th>
                  <th>{t('DATE', 'التاريخ')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const incoming = [
                    'RESTOCK',
                    'ADJUSTMENT_IN',
                    'RETURN',
                  ].includes(movement.type);

                  const actorName = [
                    movement.user?.firstName,
                    movement.user?.lastName,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <tr key={movement.id}>
                      <td>
                        <div className="inventory-movement-product">
                          <strong>
                            {movement.product?.name ||
                              t('Unknown product', 'منتج غير معروف')}
                          </strong>
                          <span>{movement.product?.sku || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inventory-movement-type ${
                            incoming ? 'movement-in' : 'movement-out'
                          }`}
                        >
                          {movementLabel(movement.type, isArabic)}
                        </span>
                      </td>
                      <td>
                        <strong
                          className={
                            incoming
                              ? 'inventory-quantity-in'
                              : 'inventory-quantity-out'
                          }
                        >
                          {incoming ? '+' : '−'}{movement.quantity}
                        </strong>
                      </td>
                      <td className="inventory-note-cell">
                        {movement.note || '—'}
                      </td>
                      <td>{actorName || movement.user?.email || '—'}</td>
                      <td className="inventory-muted">
                        {formatDate(movement.createdAt, isArabic)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {activeMode && (
        <div
          className="inventory-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-modal-title"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="inventory-modal-heading">
              <div>
                <span className="inventory-eyebrow">
                  {activeMode === 'restock'
                    ? t('STOCK INCREASE', 'زيادة المخزون')
                    : t('STOCK CORRECTION', 'تسوية المخزون')}
                </span>
                <h2 id="inventory-modal-title">
                  {activeMode === 'restock'
                    ? t('Restock product', 'إعادة تعبئة المنتج')
                    : t('Adjust inventory', 'تعديل المخزون')}
                </h2>
                <p>
                  {activeMode === 'restock'
                    ? t(
                        'Record new units added to your inventory.',
                        'سجّل الكميات الجديدة المضافة إلى المخزون.',
                      )
                    : t(
                        'Record an incoming or outgoing stock adjustment.',
                        'سجّل زيادة أو نقصانًا في كمية المخزون.',
                      )}
                </p>
              </div>
              <button
                className="inventory-modal-close"
                type="button"
                onClick={closeForm}
                disabled={submitting}
                aria-label={t('Close form', 'إغلاق النموذج')}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="inventory-form">
              <label className="inventory-field">
                <span>{t('Product', 'المنتج')} <b>*</b></span>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    {t('Select a product', 'اختر منتجًا')}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.stockQuantity}{' '}
                      {t('in stock', 'في المخزون')}
                    </option>
                  ))}
                </select>
              </label>

              {activeMode === 'adjust' && (
                <fieldset className="inventory-adjustment-type">
                  <legend>{t('Adjustment type', 'نوع التعديل')}</legend>
                  <label
                    className={adjustmentType === 'ADJUSTMENT_IN' ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="adjustmentType"
                      value="ADJUSTMENT_IN"
                      checked={adjustmentType === 'ADJUSTMENT_IN'}
                      onChange={() => setAdjustmentType('ADJUSTMENT_IN')}
                    />
                    <span>{t('↑ Increase stock', '↑ زيادة المخزون')}</span>
                  </label>
                  <label
                    className={adjustmentType === 'ADJUSTMENT_OUT' ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="adjustmentType"
                      value="ADJUSTMENT_OUT"
                      checked={adjustmentType === 'ADJUSTMENT_OUT'}
                      onChange={() => setAdjustmentType('ADJUSTMENT_OUT')}
                    />
                    <span>{t('↓ Decrease stock', '↓ تخفيض المخزون')}</span>
                  </label>
                </fieldset>
              )}

              <label className="inventory-field">
                <span>{t('Quantity', 'الكمية')} <b>*</b></span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </label>

              <label className="inventory-field">
                <span>
                  {t('Note', 'ملاحظة')} <small>{t('Optional', 'اختياري')}</small>
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={
                    activeMode === 'restock'
                      ? t(
                          'e.g. New supplier delivery',
                          'مثال: توريد جديد من المورّد',
                        )
                      : t(
                          'e.g. Damaged items or stock count correction',
                          'مثال: منتجات تالفة أو تصحيح جرد المخزون',
                        )
                  }
                />
                <small className="inventory-character-count">
                  {note.length}/500
                </small>
              </label>

              {error && (
                <div className="inventory-alert inventory-alert-error" role="alert">
                  {error}
                </div>
              )}

              <div className="inventory-form-actions">
                <button
                  type="button"
                  className="inventory-button inventory-button-secondary"
                  onClick={closeForm}
                  disabled={submitting}
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  className="inventory-button inventory-button-primary"
                  disabled={submitting || products.length === 0}
                >
                  {submitting
                    ? t('Saving…', 'جارٍ الحفظ…')
                    : activeMode === 'restock'
                      ? t('Confirm restock', 'تأكيد إعادة التعبئة')
                      : t('Save adjustment', 'حفظ التعديل')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}