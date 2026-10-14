
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Reports.css';

type Period = '7' | '30' | '90';

interface ReportProduct {
  id: string;
  name: string;
  sku: string;
  sold: number;
  revenue: number;
}

interface ChartItem {
  date: string;
  value: number;
}

interface ReportData {
  period: number;
  currency: string;
  revenue: number;
  orders: number;
  previousRevenue: number;
  previousOrders: number;
  revenueChange: number | null;
  ordersChange: number | null;
  averageOrder: number;
  chart: ChartItem[];
  topProducts: ReportProduct[];
}

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export default function Reports() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = useCallback(
    (english: string, arabic: string) =>
      isArabic ? arabic : english,
    [isArabic],
  );

  const [period, setPeriod] = useState<Period>('7');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(isArabic ? 'ar-JO' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(value);

  const currency = (value: number) =>
    new Intl.NumberFormat(isArabic ? 'ar-JO' : 'en-US', {
      style: 'currency',
      currency: 'JOD',
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(isArabic ? 'ar-JO' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${date}T12:00:00`));

  useEffect(() => {
    const controller = new AbortController();

    async function loadReport() {
      setLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('nexa_token');
        const savedOrganization = localStorage.getItem(
          'nexa_organization',
        );

        if (!token || !savedOrganization) {
          throw new Error('SESSION_EXPIRED');
        }

        let organization: { id?: string };

        try {
          organization = JSON.parse(savedOrganization) as {
            id?: string;
          };
        } catch {
          throw new Error('INVALID_ORGANIZATION');
        }

        if (!organization.id) {
          throw new Error('INVALID_ORGANIZATION');
        }

        const params = new URLSearchParams({
          organizationId: organization.id,
          period,
        });

        const response = await fetch(
          `${API_URL}/sales/reports?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          throw new Error('SESSION_EXPIRED');
        }

        if (response.status === 403) {
          throw new Error('ACCESS_DENIED');
        }

        if (!response.ok) {
          throw new Error('REPORT_FAILED');
        }

        const result = (await response.json()) as ReportData;

        if (
          typeof result.revenue !== 'number' ||
          typeof result.orders !== 'number' ||
          !Array.isArray(result.chart) ||
          !Array.isArray(result.topProducts)
        ) {
          throw new Error('INVALID_RESPONSE');
        }

        if (!controller.signal.aborted) {
          setReport(result);
        }
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === 'AbortError'
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setReport(null);

          const message =
            err instanceof Error ? err.message : '';

          const errorMessages: Record<string, string> = {
            SESSION_EXPIRED: t(
              'Your session has expired. Please log in again.',
              'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
            ),
            INVALID_ORGANIZATION: t(
              'The selected organization could not be read. Please select your organization again.',
              'تعذرت قراءة المؤسسة الحالية. يرجى اختيار المؤسسة مرة أخرى.',
            ),
            ACCESS_DENIED: t(
              'You do not have access to this organization.',
              'ليس لديك صلاحية الوصول إلى هذه المؤسسة.',
            ),
            REPORT_FAILED: t(
              'Could not load reports from the server.',
              'تعذر تحميل التقارير من الخادم.',
            ),
            INVALID_RESPONSE: t(
              'The server returned an unexpected report format.',
              'أعاد الخادم بيانات تقارير بتنسيق غير متوقع.',
            ),
          };

          setError(
            errorMessages[message] ||
              t(
                'A connection error occurred. Check that the backend is running.',
                'حدث خطأ في الاتصال. تأكد من تشغيل الـ Backend.',
              ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

loadReport();

    return () => controller.abort();
  }, [period, t]);

  const stats = useMemo(() => {
    if (!report) return null;

    return {
      maxChartValue: Math.max(
        ...report.chart.map((item) => item.value),
        1,
      ),
      maxProductRevenue: Math.max(
        ...report.topProducts.map((item) => item.revenue),
        1,
      ),
      totalProductRevenue: report.topProducts.reduce(
        (sum, item) => sum + item.revenue,
        0,
      ),
    };
  }, [report]);

  const changeText = (value: number | null) => {
    if (value === null) {
      return t(
        'No previous-period data',
        'لا توجد بيانات للفترة السابقة',
      );
    }

    const sign = value > 0 ? '+' : '';

    return `${sign}${formatNumber(value)}% ${t(
      'vs previous period',
      'مقارنة بالفترة السابقة',
    )}`;
  };

  const periodLabel = {
    '7': t('Last 7 days', 'آخر 7 أيام'),
    '30': t('Last 30 days', 'آخر 30 يومًا'),
    '90': t('Last 90 days', 'آخر 90 يومًا'),
  }[period];

  if (loading && !report) {
    return (
      <div
        className="reports-page"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <header className="reports-heading">
          <div>
            <div className="reports-eyebrow">
              {t('WORKSPACE / REPORTS', 'مساحة العمل / التقارير')}
            </div>
            <h1>{t('Reports & Analytics', 'التقارير والتحليلات')}</h1>
          </div>
        </header>

        <section className="reports-panel">
          {t(
            'Loading real report data...',
            'جارٍ تحميل بيانات التقارير...',
          )}
        </section>
      </div>
    );
  }

  return (
    <div
      className="reports-page"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <header className="reports-heading">
        <div>
          <div className="reports-eyebrow">
            {t('WORKSPACE / REPORTS', 'مساحة العمل / التقارير')}
          </div>
          <h1>{t('Reports & Analytics', 'التقارير والتحليلات')}</h1>
          <p>
            {t(
              'Track business performance using real sales data.',
              'تابع أداء أعمالك باستخدام بيانات المبيعات الفعلية.',
            )}
          </p>
        </div>

        <div className="reports-heading-actions">
          <label className="reports-period-select">
            <span>{t('Period', 'الفترة')}</span>
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as Period)
              }
              aria-label={t('Report period', 'الفترة الزمنية للتقرير')}
            >
              <option value="7">{t('Last 7 days', 'آخر 7 أيام')}</option>
              <option value="30">{t('Last 30 days', 'آخر 30 يومًا')}</option>
              <option value="90">{t('Last 90 days', 'آخر 90 يومًا')}</option>
            </select>
          </label>

          <button
            type="button"
            className="reports-primary-btn"
            onClick={() => window.print()}
          >
            <span>↓</span> {t('Export report', 'تصدير التقرير')}
          </button>
        </div>
      </header>

      {error && (
        <section className="reports-panel" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="reports-primary-btn"
            onClick={() => setPeriod(period)}
          >
            {t('Retry', 'إعادة المحاولة')}
          </button>
        </section>
      )}

      {!error && report && stats && (
        <>
          <section className="reports-metrics">
            <article className="reports-metric">
              <div className="reports-metric-top">
                <span>{t('Total revenue', 'إجمالي الإيرادات')}</span>
                <span className="reports-metric-icon">JD</span>
              </div>
              <strong>{currency(report.revenue)}</strong>
              <small className="reports-change">
                {changeText(report.revenueChange)}
              </small>
            </article>

            <article className="reports-metric">
              <div className="reports-metric-top">
                <span>{t('Total orders', 'إجمالي المبيعات')}</span>
                <span className="reports-metric-icon">▤</span>
              </div>
              <strong>{formatNumber(report.orders)}</strong>
              <small className="reports-change">
                {changeText(report.ordersChange)}
              </small>
            </article>

            <article className="reports-metric">
              <div className="reports-metric-top">
                <span>{t('Average sale value', 'متوسط قيمة البيع')}</span>
                <span className="reports-metric-icon warning">JD</span>
              </div>
              <strong>{currency(report.averageOrder)}</strong>
              <small>
                {t(
                  'Revenue per completed sale',
                  'الإيرادات لكل عملية بيع مكتملة',
                )}
              </small>
            </article>

            <article className="reports-metric">
              <div className="reports-metric-top">
                <span>{t('Previous revenue', 'إيرادات الفترة السابقة')}</span>
                <span className="reports-metric-icon">↗</span>
              </div>
              <strong>{currency(report.previousRevenue)}</strong>
              <small>
                {t(
                  'Previous comparable period',
                  'الفترة السابقة المماثلة',
                )}
              </small>
            </article>
          </section>

          <section className="reports-main-grid">
            <article className="reports-panel reports-chart-panel">
              <div className="reports-panel-heading">
                <div>
                  <h2>{t('Revenue overview', 'نظرة عامة على الإيرادات')}</h2>
                  <p>{periodLabel}</p>
                </div>
                <span className="reports-legend">
                  <span /> {t('Revenue', 'الإيرادات')}
                </span>
              </div>

              <div className="reports-chart-summary">
                <strong>{currency(report.revenue)}</strong>
                <span>{changeText(report.revenueChange)}</span>
              </div>

              {report.chart.length === 0 ? (
                <p>
                  {t(
                    'No completed sales were recorded during this period.',
                    'لا توجد مبيعات مكتملة خلال هذه الفترة.',
                  )}
                </p>
              ) : (
                <div className="reports-chart">
                  <div className="reports-chart-y-axis">
                    <span>{currency(stats.maxChartValue)}</span>
                    <span>{currency(stats.maxChartValue * 0.75)}</span>
                    <span>{currency(stats.maxChartValue * 0.5)}</span>
                    <span>{currency(stats.maxChartValue * 0.25)}</span>
                    <span>{currency(0)}</span>
                  </div>

                  <div className="reports-chart-plot">
                    <div className="reports-chart-grid">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>

                    <div className="reports-bars">
                      {report.chart.map((item) => (
                        <div
                          className="reports-bar-column"
                          key={item.date}
                        >
                          <div className="reports-bar-track">
                            <div
                              className="reports-bar"
                              style={{
                                height: `${Math.max(
                                  (item.value / stats.maxChartValue) * 100,
                                  2,
                                )}%`,
                              }}
                              title={`${formatDate(item.date)}: ${currency(item.value)}`}
                            />
                          </div>
                          <span className="reports-bar-label">
                            {formatDate(item.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="reports-panel reports-performance-panel">
              <div className="reports-panel-heading">
                <div>
                  <h2>{t('Sales performance', 'أداء المبيعات')}</h2>
                  <p>
                    {t(
                      'Actual business indicators',
                      'مؤشرات الأعمال الفعلية',
                    )}
                  </p>
                </div>
                <span className="reports-performance-icon">↗</span>
              </div>

              <div className="reports-performance-list">
                <div className="reports-performance-item">
                  <div className="reports-performance-label">
                    <span>{t('Completed sales', 'المبيعات المكتملة')}</span>
                    <strong>{formatNumber(report.orders)}</strong>
                  </div>
                  <small>
                    {t(
                      'Sales included in these reports',
                      'عمليات البيع المحتسبة في التقرير',
                    )}
                  </small>
                </div>

                <div className="reports-performance-item">
                  <div className="reports-performance-label">
                    <span>{t('Revenue per sale', 'الإيراد لكل عملية بيع')}</span>
                    <strong>{currency(report.averageOrder)}</strong>
                  </div>
                  <small>
                    {t(
                      'Calculated from completed sales',
                      'محسوب من المبيعات المكتملة',
                    )}
                  </small>
                </div>

                <div className="reports-performance-item">
                  <div className="reports-performance-label">
                    <span>
                      {t('Previous period sales', 'مبيعات الفترة السابقة')}
                    </span>
                    <strong>{formatNumber(report.previousOrders)}</strong>
                  </div>
                  <small>
                    {t(
                      'For comparison with the selected period',
                      'للمقارنة مع الفترة المختارة',
                    )}
                  </small>
                </div>
              </div>

              <div className="reports-insight">
                <span className="reports-insight-icon">✦</span>
                <div>
                  <strong>{t('Business insight', 'رؤية الأعمال')}</strong>
                  <p>
                    {report.revenueChange === null
                      ? t(
                          'There is no previous revenue to compare against.',
                          'لا توجد إيرادات سابقة لإجراء المقارنة.',
                        )
                      : report.revenueChange > 0
                        ? t(
                            `Revenue increased by ${report.revenueChange}% compared with the previous period.`,
                            `ارتفعت الإيرادات بنسبة ${report.revenueChange}% مقارنة بالفترة السابقة.`,
                          )
                        : report.revenueChange < 0
                          ? t(
                              `Revenue decreased by ${Math.abs(report.revenueChange)}% compared with the previous period.`,
                              `انخفضت الإيرادات بنسبة ${Math.abs(report.revenueChange)}% مقارنة بالفترة السابقة.`,
                            )
                          : t(
                              'Revenue is unchanged compared with the previous period.',
                              'الإيرادات لم تتغير مقارنة بالفترة السابقة.',
                            )}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="reports-bottom-grid">
            <article className="reports-panel reports-products-panel">
              <div className="reports-panel-heading">
                <div>
                  <h2>{t('Top selling products', 'المنتجات الأكثر مبيعًا')}</h2>
                  <p>
                    {t(
                      'Ranked by revenue from completed sales',
                      'مرتبة حسب الإيرادات من المبيعات المكتملة',
                    )}
                  </p>
                </div>
                <span className="reports-subtle-badge">
                  {t('Top 5', 'أفضل 5')}
                </span>
              </div>

              {report.topProducts.length === 0 ? (
                <p>
                  {t(
                    'No product sales were recorded during this period.',
                    'لا توجد مبيعات منتجات خلال هذه الفترة.',
                  )}
                </p>
              ) : (
                <div className="reports-products-list">
                  {report.topProducts.map((product, index) => (
                    <div
                      className="reports-product-row"
                      key={product.id}
                    >
                      <span className="reports-product-rank">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="reports-product-info">
                        <strong>{product.name}</strong>
                        <small>
                          {product.sku} · {formatNumber(product.sold)}{' '}
                          {t('units sold', 'قطعة مباعة')}
                        </small>
                        <div className="reports-product-progress">
                          <span
                            style={{
                              width: `${Math.max(
                                (product.revenue / stats.maxProductRevenue) * 100,
                                2,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <strong className="reports-product-revenue">
                        {currency(product.revenue)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              <footer className="reports-products-footer">
                <span>
                  {t(
                    'Revenue from listed products',
                    'إيرادات المنتجات المعروضة',
                  )}
                </span>
                <strong>{currency(stats.totalProductRevenue)}</strong>
              </footer>
            </article>

            <article className="reports-panel reports-activity-panel">
              <div className="reports-panel-heading">
                <div>
                  <h2>{t('Report information', 'معلومات التقرير')}</h2>
                  <p>{t('Current data source', 'مصدر البيانات الحالي')}</p>
                </div>
                <span className="reports-subtle-badge">
                  {t('Live data', 'بيانات فعلية')}
                </span>
              </div>

              <div className="reports-activity-list">
                <div className="reports-activity-item">
                  <span className="reports-activity-icon">✓</span>
                  <div className="reports-activity-content">
                    <strong>{t('Sales database', 'قاعدة بيانات المبيعات')}</strong>
                    <small>
                      {t('Completed sales only', 'المبيعات المكتملة فقط')}
                    </small>
                  </div>
                </div>

                <div className="reports-activity-item">
                  <span className="reports-activity-icon">▦</span>
                  <div className="reports-activity-content">
                    <strong>{t('Organization filter', 'تصفية المؤسسة')}</strong>
                    <small>
                      {t(
                        'Current selected organization',
                        'المؤسسة المحددة حاليًا',
                      )}
                    </small>
                  </div>
                </div>

                <div className="reports-activity-item">
                  <span className="reports-activity-icon">◷</span>
                  <div className="reports-activity-content">
                    <strong>{t('Selected period', 'الفترة المختارة')}</strong>
                    <small>{periodLabel}</small>
                  </div>
                </div>
              </div>

              <div className="reports-activity-note">
                {t(
                  'Customer retention and live activity are not included because the current API does not provide those metrics.',
                  'لم تتم إضافة الاحتفاظ بالعملاء والنشاط المباشر لأن واجهة API الحالية لا توفر هذه المؤشرات.',
                )}
              </div>
            </article>
          </section>

          <footer className="reports-footer">
            <span>
              {t('Report period:', 'فترة التقرير:')} {periodLabel}
            </span>
            <span>
              {t('Source: NEXA sales API', 'المصدر: واجهة مبيعات NEXA')}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}
