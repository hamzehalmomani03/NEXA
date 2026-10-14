import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Products.css';

type ProductStatus = 'ACTIVE' | 'INACTIVE';

type Product = {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  description?: string | null;
  price: string | number;
  costPrice: string | number;
  stockQuantity: number;
  lowStockAt: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

type ProductForm = {
  name: string;
  sku: string;
  description: string;
  price: string;
  costPrice: string;
  stockQuantity: string;
  lowStockAt: string;
};

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

/* =========================
   ORGANIZATION
========================= */

function getOrganizationId(): string {
  // Organization data is stored as JSON separately from the JWT.
  const savedOrganization = localStorage.getItem('nexa_organization');

  if (!savedOrganization) {
    throw new Error('No organization selected. Please sign in again.');
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

/* =========================
   FORM DEFAULTS
========================= */

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  description: '',
  price: '',
  costPrice: '0',
  stockQuantity: '0',
  lowStockAt: '5',
};

/* =========================
   API REQUEST
========================= */

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Login.tsx stores the JWT in localStorage.
  // A JWT is a string, so never JSON.parse it.
  const token = localStorage.getItem('nexa_token');

  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`,
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

    throw new Error(
      Array.isArray(message) ? message.join(', ') : String(message),
    );
  }

  return data as T;
}

/* =========================
   HELPERS
========================= */

function formatPrice(value: string | number, isArabic: boolean) {
  const amount = Number(value);

  return new Intl.NumberFormat(isArabic ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getStockState(product: Product, isArabic: boolean) {
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

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

/* =========================
   PRODUCTS PAGE
========================= */

export default function Products() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  /* =========================
     LOAD PRODUCTS
  ========================= */

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({
        organizationId: getOrganizationId(),
      });

      const result = await apiRequest<{
        success: boolean;
        count: number;
        products: Product[];
      }>(`/products?${query.toString()}`);

      setProducts(Array.isArray(result.products) ? result.products : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  /* =========================
     SEARCH & METRICS
  ========================= */

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.description || '',
        product.status,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [products, search]);

  const metrics = useMemo(() => {
    const inventoryValue = products.reduce(
      (total, product) =>
        total + Number(product.price) * product.stockQuantity,
      0,
    );

    return {
      total: products.length,
      lowStock: products.filter(
        (product) =>
          product.stockQuantity > 0 &&
          product.stockQuantity <= product.lowStockAt,
      ).length,
      outOfStock: products.filter(
        (product) => product.stockQuantity <= 0,
      ).length,
      inventoryValue,
    };
  }, [products]);

  /* =========================
     MODAL
  ========================= */

  function openCreateModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);

    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      price: String(product.price),
      costPrice: String(product.costPrice ?? 0),
      stockQuantity: String(product.stockQuantity),
      lowStockAt: String(product.lowStockAt),
    });

    setError('');
    setNotice('');
    setModalOpen(true);
  }

  function updateField<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  /* =========================
     CREATE / UPDATE PRODUCT
  ========================= */

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError('');
    setNotice('');

    const price = Number(form.price);
    const costPrice = Number(form.costPrice);
    const stockQuantity = Number(form.stockQuantity);
    const lowStockAt = Number(form.lowStockAt);

    if (!form.name.trim() || !form.sku.trim()) {
      setError(
        t(
          'Product name and SKU are required.',
          'اسم المنتج ورمز SKU مطلوبان.',
        ),
      );
      return;
    }

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(costPrice) ||
      price < 0 ||
      costPrice < 0
    ) {
      setError(
        t(
          'Enter valid prices. Prices cannot be negative.',
          'أدخل أسعارًا صحيحة. لا يمكن أن تكون الأسعار سالبة.',
        ),
      );
      return;
    }

    if (
      !Number.isInteger(stockQuantity) ||
      !Number.isInteger(lowStockAt) ||
      stockQuantity < 0 ||
      lowStockAt < 0
    ) {
      setError(
        t(
          'Stock quantity and low-stock threshold must be whole numbers.',
          'يجب أن تكون كمية المخزون وحد التنبيه أعدادًا صحيحة غير سالبة.',
        ),
      );
      return;
    }

    let organizationId: string | undefined;

    try {
      if (!editingProduct) {
        organizationId = getOrganizationId();
      }
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim() || undefined,
      price,
      costPrice,
      stockQuantity,
      lowStockAt,
      ...(!editingProduct && { organizationId }),
    };

    setSaving(true);

    try {
      if (editingProduct) {
        await apiRequest(
          `/products/${encodeURIComponent(editingProduct.id)}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );

        setNotice(
          t(
            'Product updated successfully.',
            'تم تحديث المنتج بنجاح.',
          ),
        );
      } else {
        await apiRequest('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setNotice(
          t(
            'Product created successfully.',
            'تمت إضافة المنتج بنجاح.',
          ),
        );
      }

      setModalOpen(false);
      setEditingProduct(null);
      setForm(emptyForm);

      await loadProducts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     DELETE PRODUCT
  ========================= */

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      t(
        `Delete "${product.name}"? This action cannot be undone.`,
        `هل تريد حذف "${product.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      ),
    );

    if (!confirmed) return;

    setDeletingId(product.id);
    setError('');
    setNotice('');

    try {
      await apiRequest(
        `/products/${encodeURIComponent(product.id)}`,
        { method: 'DELETE' },
      );

      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );

      setNotice(
        t(
          `"${product.name}" was deleted.`,
          `تم حذف "${product.name}".`,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <section
      className="products-page"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <header className="products-heading">
        <div>
          <div className="products-eyebrow">
            {t('INVENTORY MANAGEMENT', 'إدارة المخزون')}
          </div>

          <h1>{t('Products', 'المنتجات')}</h1>

          <p>
            {t(
              'Manage your catalog, prices, and stock levels.',
              'أدر قائمة منتجاتك وأسعارها ومستويات مخزونها.',
            )}
          </p>
        </div>

        <button
          className="products-primary-button"
          onClick={openCreateModal}
          type="button"
        >
          <span aria-hidden="true">＋</span>{' '}
          {t('Add product', 'إضافة منتج')}
        </button>
      </header>

      {error && (
        <div
          className="products-alert products-alert-error"
          role="alert"
        >
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

      {notice && (
        <div
          className="products-alert products-alert-success"
          role="status"
        >
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label={t('Dismiss message', 'إغلاق الرسالة')}
          >
            ×
          </button>
        </div>
      )}

      <div className="products-metrics">
        <article className="products-metric">
          <div className="products-metric-top">
            <span>{t('Total products', 'إجمالي المنتجات')}</span>
            <span className="products-metric-icon">▦</span>
          </div>

          <strong>{loading ? '...' : metrics.total}</strong>

          <small>
            {t('Products in your catalog', 'عدد المنتجات في قائمتك')}
          </small>
        </article>

        <article className="products-metric">
          <div className="products-metric-top">
            <span>{t('Low stock', 'مخزون منخفض')}</span>
            <span className="products-metric-icon warning">!</span>
          </div>

          <strong>{loading ? '...' : metrics.lowStock}</strong>

          <small>
            {t('Products need attention', 'منتجات تحتاج إلى متابعة')}
          </small>
        </article>

        <article className="products-metric">
          <div className="products-metric-top">
            <span>{t('Out of stock', 'نفد المخزون')}</span>
            <span className="products-metric-icon danger">↘</span>
          </div>

          <strong>{loading ? '...' : metrics.outOfStock}</strong>

          <small>
            {t('Products with zero quantity', 'منتجات كميتها صفر')}
          </small>
        </article>

        <article className="products-metric">
          <div className="products-metric-top">
            <span>{t('Retail stock value', 'القيمة البيعية للمخزون')}</span>
            <span className="products-metric-icon">JOD</span>
          </div>

          <strong className="products-value">
            {loading
              ? '...'
              : formatPrice(metrics.inventoryValue, isArabic)}
          </strong>

          <small>
            {t(
              'Price × current quantity',
              'سعر البيع × الكمية الحالية',
            )}
          </small>
        </article>
      </div>

      <div className="products-panel">
        <div className="products-toolbar">
          <div>
            <h2>{t('Product catalog', 'قائمة المنتجات')}</h2>

            <p>
              {t(
                `${filteredProducts.length} products shown`,
                `عدد المنتجات المعروضة: ${filteredProducts.length}`,
              )}
            </p>
          </div>

          <div className="products-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              placeholder={t(
                'Search name, SKU...',
                'ابحث بالاسم أو رمز SKU...',
              )}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t('Search products', 'البحث عن المنتجات')}
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
        </div>

        {loading ? (
          <div className="products-state">
            <div className="products-spinner" />

            <p>
              {t('Loading your products...', 'جارٍ تحميل المنتجات...')}
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="products-state">
            <div className="products-empty-icon">▦</div>

            <h3>
              {search
                ? t('No matching products', 'لا توجد منتجات مطابقة')
                : t('Your catalog is empty', 'قائمة المنتجات فارغة')}
            </h3>

            <p>
              {search
                ? t(
                    'Try a different name or SKU.',
                    'جرّب اسمًا أو رمز SKU مختلفًا.',
                  )
                : t(
                    'Add your first product to start managing your inventory.',
                    'أضف أول منتج لتبدأ بإدارة مخزونك.',
                  )}
            </p>

            {!search && (
              <button
                type="button"
                className="products-primary-button"
                onClick={openCreateModal}
              >
                ＋ {t('Add your first product', 'أضف أول منتج')}
              </button>
            )}
          </div>
        ) : (
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>{t('PRODUCT', 'المنتج')}</th>
                  <th>SKU</th>
                  <th>{t('PRICE', 'السعر')}</th>
                  <th>{t('QUANTITY', 'الكمية')}</th>
                  <th>{t('STOCK STATUS', 'حالة المخزون')}</th>
                  <th>{t('STATUS', 'الحالة')}</th>
                  <th className="products-actions-heading">
                    {t('ACTIONS', 'الإجراءات')}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const stock = getStockState(product, isArabic);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="products-name-cell">
                          <div className="products-avatar">
                            {product.name.trim().charAt(0).toUpperCase() || 'P'}
                          </div>

                          <div>
                            <strong>{product.name}</strong>

                            <small>
                              {product.description ||
                                t('No description', 'لا يوجد وصف')}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <code className="products-sku">{product.sku}</code>
                      </td>

                      <td className="products-price">
                        {formatPrice(product.price, isArabic)}
                      </td>

                      <td>
                        <span className="products-quantity">
                          {product.stockQuantity}
                        </span>

                        <small className="products-threshold">
                          {t('Alert at', 'التنبيه عند')} {product.lowStockAt}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`products-stock-badge ${stock.className}`}
                        >
                          <span />
                          {stock.label}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`products-status ${
                            product.status === 'ACTIVE'
                              ? 'active'
                              : 'inactive'
                          }`}
                        >
                          {product.status === 'ACTIVE'
                            ? t('Active', 'نشط')
                            : t('Inactive', 'غير نشط')}
                        </span>
                      </td>

                      <td>
                        <div className="products-row-actions">
                          <button
                            type="button"
                            className="products-icon-button"
                            onClick={() => openEditModal(product)}
                            aria-label={t(
                              `Edit ${product.name}`,
                              `تعديل ${product.name}`,
                            )}
                            title={t('Edit product', 'تعديل المنتج')}
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            className="products-icon-button delete"
                            onClick={() => void handleDelete(product)}
                            disabled={deletingId === product.id}
                            aria-label={t(
                              `Delete ${product.name}`,
                              `حذف ${product.name}`,
                            )}
                            title={t('Delete product', 'حذف المنتج')}
                          >
                            {deletingId === product.id ? '…' : '⌫'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="products-panel-footer">
          <span>
            {t(
              `Showing ${filteredProducts.length} of ${products.length} products`,
              `عرض ${filteredProducts.length} من أصل ${products.length} منتجًا`,
            )}
          </span>

          <button
            type="button"
            className="products-refresh-button"
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            ↻ {t('Refresh', 'تحديث')}
          </button>
        </footer>
      </div>

      {modalOpen && (
        <div
          className="products-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setModalOpen(false);
            }
          }}
        >
          <section
            className="products-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-modal-title"
          >
            <header className="products-modal-header">
              <div>
                <div className="products-eyebrow">
                  {editingProduct
                    ? t('UPDATE CATALOG', 'تحديث قائمة المنتجات')
                    : t('NEW CATALOG ITEM', 'منتج جديد')}
                </div>

                <h2 id="products-modal-title">
                  {editingProduct
                    ? t('Edit product', 'تعديل المنتج')
                    : t('Add product', 'إضافة منتج')}
                </h2>

                <p>
                  {editingProduct
                    ? t(
                        'Update the product details below.',
                        'حدّث بيانات المنتج أدناه.',
                      )
                    : t(
                        'Enter the details to add a product to your catalog.',
                        'أدخل البيانات لإضافة منتج إلى قائمتك.',
                      )}
                </p>
              </div>

              <button
                type="button"
                className="products-modal-close"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label={t('Close dialog', 'إغلاق النافذة')}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              <div className="products-form-grid">
                <label className="products-field full">
                  <span>
                    {t('Product name', 'اسم المنتج')} <b>*</b>
                  </span>

                  <input
                    autoFocus
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(event) =>
                      updateField('name', event.target.value)
                    }
                    placeholder={t(
                      'e.g. Wireless Mouse',
                      'مثال: فأرة لاسلكية',
                    )}
                  />
                </label>

                <label className="products-field">
                  <span>
                    SKU <b>*</b>
                  </span>

                  <input
                    required
                    maxLength={64}
                    pattern="[A-Za-z0-9_-]+"
                    title={t(
                      'Use letters, numbers, hyphens, or underscores.',
                      'استخدم الأحرف الإنجليزية والأرقام والشرطة أو الشرطة السفلية.',
                    )}
                    value={form.sku}
                    onChange={(event) =>
                      updateField('sku', event.target.value)
                    }
                    placeholder="e.g. MOUSE-001"
                  />
                </label>

                <label className="products-field">
                  <span>
                    {t('Selling price (JOD)', 'سعر البيع (دينار أردني)')} <b>*</b>
                  </span>

                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      updateField('price', event.target.value)
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="products-field">
                  <span>
                    {t('Cost price (JOD)', 'سعر التكلفة (دينار أردني)')}
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(event) =>
                      updateField('costPrice', event.target.value)
                    }
                  />
                </label>

                <label className="products-field">
                  <span>{t('Stock quantity', 'كمية المخزون')}</span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stockQuantity}
                    onChange={(event) =>
                      updateField('stockQuantity', event.target.value)
                    }
                  />
                </label>

                <label className="products-field">
                  <span>
                    {t(
                      'Low-stock alert at',
                      'حد التنبيه عند انخفاض المخزون',
                    )}
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.lowStockAt}
                    onChange={(event) =>
                      updateField('lowStockAt', event.target.value)
                    }
                  />
                </label>

                <label className="products-field full">
                  <span>{t('Description', 'الوصف')}</span>

                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) =>
                      updateField('description', event.target.value)
                    }
                    placeholder={t(
                      'Add a short product description...',
                      'أضف وصفًا مختصرًا للمنتج...',
                    )}
                  />
                </label>
              </div>

              {error && (
                <div
                  className="products-alert products-alert-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <footer className="products-modal-footer">
                <button
                  type="button"
                  className="products-secondary-button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  {t('Cancel', 'إلغاء')}
                </button>

                <button
                  type="submit"
                  className="products-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? t('Saving...', 'جارٍ الحفظ...')
                    : editingProduct
                      ? t('Save changes', 'حفظ التعديلات')
                      : t('Create product', 'إنشاء المنتج')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
