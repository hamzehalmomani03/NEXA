
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import './Settings.css';

type SettingsSection =
  | 'General'
  | 'Profile'
  | 'Notifications'
  | 'Security'
  | 'Preferences';

type SettingsData = {
  companyName: string;
  industry: string;
  companyEmail: string;
  phone: string;
  fullName: string;
  email: string;
  jobTitle: string;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
};

type TwoFactorSetup = {
  qrCodeDataUrl: string;
  manualEntryKey: string;
};

const initialSettings: SettingsData = {
  companyName: 'NEXA Workspace',
  industry: 'Retail & E-commerce',
  companyEmail: 'contact@nexa.com',
  phone: '',
  fullName: 'Hamzeh Almomani',
  email: 'hamzeh@nexa.com',
  jobTitle: 'Workspace Owner',
  language: 'English',
  timezone: 'Asia/Amman',
  currency: 'JOD',
  dateFormat: 'DD/MM/YYYY',
};

const sections: {
  name: SettingsSection;
  icon: string;
  description: string;
}[] = [
  { name: 'General', icon: '▦', description: 'Workspace details' },
  { name: 'Profile', icon: '♙', description: 'Your personal information' },
  { name: 'Notifications', icon: '♧', description: 'Alerts and updates' },
  { name: 'Security', icon: '◇', description: 'Password and account security' },
  { name: 'Preferences', icon: '⚙', description: 'Language and regional settings' },
];

export default function Settings() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const t = (english: string, arabic: string) =>
    isArabic ? arabic : english;

  const API_URL = import.meta.env.VITE_API_URL ?? '/api';

  const [activeSection, setActiveSection] =
    useState<SettingsSection>('General');

  const [settings, setSettings] = useState<SettingsData>(initialSettings);
  const [savedMessage, setSavedMessage] = useState('');

  const [notifications, setNotifications] = useState({
    sales: true,
    inventory: true,
    team: false,
    reports: true,
    email: false,
  });

  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  // Two-factor authentication state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] =
    useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [remainingRecoveryCodes, setRemainingRecoveryCodes] = useState(0);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');

  const sectionLabel = (section: SettingsSection) => {
    const labels: Record<SettingsSection, string> = {
      General: t('General', 'عام'),
      Profile: t('Profile', 'الملف الشخصي'),
      Notifications: t('Notifications', 'الإشعارات'),
      Security: t('Security', 'الأمان'),
      Preferences: t('Preferences', 'التفضيلات'),
    };

    return labels[section];
  };

  const sectionDescription = (section: SettingsSection) => {
    const descriptions: Record<SettingsSection, string> = {
      General: t('Workspace details', 'تفاصيل مساحة العمل'),
      Profile: t('Your personal information', 'معلوماتك الشخصية'),
      Notifications: t('Alerts and updates', 'التنبيهات والتحديثات'),
      Security: t('Password and account security', 'كلمة المرور وأمان الحساب'),
      Preferences: t(
        'Language and regional settings',
        'اللغة والإعدادات الإقليمية',
      ),
    };

    return descriptions[section];
  };

  function updateSetting<K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedMessage('');
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedMessage(
      t(
        'Your changes have been saved in this session.',
        'تم حفظ التغييرات خلال الجلسة الحالية.',
      ),
    );
  }

  function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setSavedMessage(
        t(
          'Please fill in all password fields.',
          'يرجى تعبئة جميع حقول كلمة المرور.',
        ),
      );
      return;
    }

    if (passwords.next.length < 8) {
      setSavedMessage(
        t(
          'Your new password must be at least 8 characters.',
          'يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.',
        ),
      );
      return;
    }

    if (passwords.next !== passwords.confirm) {
      setSavedMessage(
        t(
          'The new passwords do not match.',
          'كلمتا المرور الجديدتان غير متطابقتين.',
        ),
      );
      return;
    }

    setSavedMessage(
      t(
        'Password form validated. Actual password changes require backend integration.',
        'تم التحقق من نموذج كلمة المرور. تغيير كلمة المرور فعليًا يتطلب ربط الواجهة بالخادم.',
      ),
    );

    setPasswords({ current: '', next: '', confirm: '' });
  }

  function renderField(
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder = '',
    type = 'text',
  ) {
    return (
      <label className="settings-field">
        <span>{label}</span>
        <input
          type={type}
          dir={type === 'email' || type === 'tel' ? 'ltr' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>
    );
  }

  function renderSelect(
    label: string,
    value: string,
    options: string[],
    onChange: (value: string) => void,
  ) {
    return (
      <label className="settings-field">
        <span>{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function optionLabel(option: string) {
    if (!isArabic) return option;

    const labels: Record<string, string> = {
      'Retail & E-commerce': 'التجزئة والتجارة الإلكترونية',
      Technology: 'التكنولوجيا',
      'Food & Beverage': 'الأغذية والمشروبات',
      Healthcare: 'الرعاية الصحية',
      Education: 'التعليم',
      Other: 'أخرى',
      English: 'الإنجليزية',
      العربية: 'العربية',
      'Asia/Amman': 'عمّان',
      'Asia/Riyadh': 'الرياض',
      'Asia/Dubai': 'دبي',
      'Europe/London': 'لندن',
      'America/New_York': 'نيويورك',
    };

    return labels[option] ?? option;
  }

  function renderToggle(
    title: string,
    description: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ) {
    return (
      <div className="settings-toggle-row">
        <div className="settings-toggle-copy">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          className={`settings-switch ${checked ? 'is-on' : ''}`}
          onClick={() => {
            onChange(!checked);
            setSavedMessage('');
          }}
        >
          <span />
        </button>
      </div>
    );
  }

  // Make authenticated requests to the backend.
  async function twoFactorRequest(
    path: string,
    method = 'GET',
    body?: Record<string, string>,
  ) {
    const token = localStorage.getItem('nexa_token');

    if (!token) {
      throw new Error(
        t('Please sign in again.', 'يرجى تسجيل الدخول مرة أخرى.'),
      );
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message;

      throw new Error(
        message ||
          t(
            'The request failed. Please try again.',
            'فشل الطلب. حاول مرة أخرى.',
          ),
      );
    }

    return data;
  }

  async function loadTwoFactorStatus() {
    setTwoFactorLoading(true);
    setTwoFactorError('');

    try {
      const data = await twoFactorRequest('/auth/2fa/status');

      setTwoFactorEnabled(Boolean(data.enabled));
      setRemainingRecoveryCodes(data.remainingRecoveryCodes ?? 0);
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t(
              'Could not load security status.',
              'تعذّر تحميل حالة الأمان.',
            ),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  useEffect(() => {
    if (activeSection === 'Security') {
      void loadTwoFactorStatus();
    }
  }, [activeSection]);

  async function startTwoFactorSetup() {
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');
    setRecoveryCodes([]);

    try {
      const data = await twoFactorRequest('/auth/2fa/setup', 'POST');

      setTwoFactorSetup({
        qrCodeDataUrl: data.qrCodeDataUrl,
        manualEntryKey: data.manualEntryKey,
      });

      setTwoFactorCode('');
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t('Could not start setup.', 'تعذّر بدء الإعداد.'),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function confirmTwoFactorSetup(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');

    try {
      const data = await twoFactorRequest('/auth/2fa/confirm', 'POST', {
        code: twoFactorCode.trim(),
      });

      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setRecoveryCodes(data.recoveryCodes ?? []);
      setRemainingRecoveryCodes(data.recoveryCodes?.length ?? 0);

      setTwoFactorMessage(
        t(
          'Two-factor authentication is now enabled.',
          'تم تفعيل المصادقة الثنائية بنجاح.',
        ),
      );
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t('Verification failed.', 'فشل التحقق من الرمز.'),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function disableTwoFactor(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');

    try {
      await twoFactorRequest('/auth/2fa/disable', 'POST', {
        password: twoFactorPassword,
        code: twoFactorCode.trim(),
      });

      setTwoFactorEnabled(false);
      setTwoFactorSetup(null);
      setRecoveryCodes([]);
      setRemainingRecoveryCodes(0);
      setTwoFactorCode('');
      setTwoFactorPassword('');

      setTwoFactorMessage(
        t(
          'Two-factor authentication has been disabled.',
          'تم إيقاف المصادقة الثنائية.',
        ),
      );
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t(
              'Could not disable two-factor authentication.',
              'تعذّر إيقاف المصادقة الثنائية.',
            ),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function regenerateRecoveryCodes(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');
    setRecoveryCodes([]);

    try {
      const data = await twoFactorRequest(
        '/auth/2fa/recovery-codes',
        'POST',
        { code: twoFactorCode.trim() },
      );

      setRecoveryCodes(data.recoveryCodes ?? []);
      setRemainingRecoveryCodes(data.recoveryCodes?.length ?? 0);
      setTwoFactorCode('');

      setTwoFactorMessage(
        t(
          'New recovery codes generated. Save them now.',
          'تم إنشاء رموز استرداد جديدة. احفظها الآن.',
        ),
      );
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t(
              'Could not generate recovery codes.',
              'تعذّر إنشاء رموز الاسترداد.',
            ),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  }

  function downloadRecoveryCodes() {
    if (recoveryCodes.length === 0) return;

    const blob = new Blob([recoveryCodes.join('\n')], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'nexa-recovery-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function renderVerificationCodeField(label: string) {
    return (
      <label className="settings-field">
        <span>{label}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={6}
          pattern="[0-9]{6}"
          value={twoFactorCode}
          onChange={(event) =>
            setTwoFactorCode(
              event.target.value.replace(/\D/g, '').slice(0, 6),
            )
          }
          placeholder="123456"
          required
        />
      </label>
    );
  }

  return (
    <div className="settings-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="settings-header">
        <div>
          <div className="settings-eyebrow">
            <span />
            {t('WORKSPACE', 'مساحة العمل')}
          </div>

          <h1>{t('Settings', 'الإعدادات')}</h1>

          <p>
            {t(
              'Manage your workspace, preferences, and account security.',
              'أدر مساحة العمل والتفضيلات وإعدادات أمان حسابك.',
            )}
          </p>
        </div>

        <div className="settings-header-icon">⚙</div>
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-title">
            {t('SETTINGS MENU', 'قائمة الإعدادات')}
          </div>

          {sections.map((section) => (
            <button
              type="button"
              key={section.name}
              className={`settings-nav-item ${
                activeSection === section.name ? 'selected' : ''
              }`}
              onClick={() => {
                setActiveSection(section.name);
                setSavedMessage('');
              }}
            >
              <span className="settings-nav-icon">{section.icon}</span>

              <span className="settings-nav-copy">
                <strong>{sectionLabel(section.name)}</strong>
                <small>{sectionDescription(section.name)}</small>
              </span>

              <span className="settings-nav-arrow">
                {isArabic ? '‹' : '›'}
              </span>
            </button>
          ))}

          <div className="settings-help-card">
            <span>✳</span>
            <strong>{t('Need a hand?', 'هل تحتاج إلى مساعدة؟')}</strong>
            <p>
              {t(
                'Your workspace settings help NEXA work the way you do.',
                'تساعد إعدادات مساحة العمل في تخصيص NEXA بما يناسب طريقة عملك.',
              )}
            </p>
          </div>
        </aside>

        <main className="settings-content">
          <div className="settings-content-heading">
            <div>
              <h2>{sectionLabel(activeSection)}</h2>
              <p>{sectionDescription(activeSection)}</p>
            </div>

            <span className="settings-section-badge">
              <span />
              {t('Workspace', 'مساحة العمل')}
            </span>
          </div>

          {savedMessage && (
            <div className="settings-message" role="status">
              <span>✓</span>
              {savedMessage}
            </div>
          )}

          {/* GENERAL */}
          {activeSection === 'General' && (
            <form onSubmit={handleSave}>
              <section className="settings-panel">
                <div className="settings-panel-heading">
                  <div className="settings-panel-icon">▦</div>
                  <div>
                    <h3>{t('Workspace information', 'معلومات مساحة العمل')}</h3>
                    <p>
                      {t(
                        'Basic information about your business.',
                        'المعلومات الأساسية عن نشاطك التجاري.',
                      )}
                    </p>
                  </div>
                </div>

                <div className="settings-form-grid">
                  {renderField(
                    t('Workspace name', 'اسم مساحة العمل'),
                    settings.companyName,
                    (value) => updateSetting('companyName', value),
                    t('Enter workspace name', 'أدخل اسم مساحة العمل'),
                  )}

                  {renderSelect(
                    t('Industry', 'القطاع'),
                    settings.industry,
                    [
                      'Retail & E-commerce',
                      'Technology',
                      'Food & Beverage',
                      'Healthcare',
                      'Education',
                      'Other',
                    ],
                    (value) => updateSetting('industry', value),
                  )}

                  {renderField(
                    t('Business email', 'البريد الإلكتروني للشركة'),
                    settings.companyEmail,
                    (value) => updateSetting('companyEmail', value),
                    'contact@company.com',
                    'email',
                  )}

                  {renderField(
                    t('Phone number', 'رقم الهاتف'),
                    settings.phone,
                    (value) => updateSetting('phone', value),
                    '+962 7X XXX XXXX',
                    'tel',
                  )}
                </div>
              </section>

              <div className="settings-save-row">
                <span>
                  {t(
                    'Changes are local until backend integration.',
                    'التغييرات محلية حتى ربطها بالخادم.',
                  )}
                </span>

                <button className="settings-save-btn" type="submit">
                  {t('Save changes', 'حفظ التغييرات')} <span>↗</span>
                </button>
              </div>
            </form>
          )}

          {/* PROFILE */}
          {activeSection === 'Profile' && (
            <form onSubmit={handleSave}>
              <section className="settings-panel">
                <div className="settings-panel-heading">
                  <div className="settings-profile-avatar">
                    {settings.fullName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join('')}
                  </div>

                  <div>
                    <h3>{t('Personal information', 'المعلومات الشخصية')}</h3>
                    <p>
                      {t(
                        'Update the information associated with your profile.',
                        'حدّث المعلومات المرتبطة بملفك الشخصي.',
                      )}
                    </p>
                  </div>
                </div>

                <div className="settings-form-grid">
                  {renderField(
                    t('Full name', 'الاسم الكامل'),
                    settings.fullName,
                    (value) => updateSetting('fullName', value),
                    t('Your full name', 'أدخل اسمك الكامل'),
                  )}

                  {renderField(
                    t('Email address', 'البريد الإلكتروني'),
                    settings.email,
                    (value) => updateSetting('email', value),
                    'you@company.com',
                    'email',
                  )}

                  {renderField(
                    t('Job title', 'المسمى الوظيفي'),
                    settings.jobTitle,
                    (value) => updateSetting('jobTitle', value),
                    t('Your role', 'مسمّاك الوظيفي'),
                  )}
                </div>
              </section>

              <div className="settings-save-row">
                <span>
                  {t(
                    'Keep your profile information up to date.',
                    'حافظ على تحديث معلومات ملفك الشخصي.',
                  )}
                </span>

                <button className="settings-save-btn" type="submit">
                  {t('Save changes', 'حفظ التغييرات')} <span>↗</span>
                </button>
              </div>
            </form>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === 'Notifications' && (
            <form onSubmit={handleSave}>
              <section className="settings-panel">
                <div className="settings-panel-heading">
                  <div className="settings-panel-icon">♧</div>
                  <div>
                    <h3>{t('Notification preferences', 'تفضيلات الإشعارات')}</h3>
                    <p>
                      {t(
                        'Choose which workspace updates you want to see.',
                        'اختر تحديثات مساحة العمل التي تريد متابعتها.',
                      )}
                    </p>
                  </div>
                </div>

                {renderToggle(
                  t('Sales updates', 'تحديثات المبيعات'),
                  t(
                    'Get notified when sales activity changes.',
                    'احصل على إشعارات عند حدوث تغييرات في نشاط المبيعات.',
                  ),
                  notifications.sales,
                  (checked) =>
                    setNotifications((current) => ({
                      ...current,
                      sales: checked,
                    })),
                )}

                {renderToggle(
                  t('Low inventory alerts', 'تنبيهات انخفاض المخزون'),
                  t(
                    'Receive alerts when products need restocking.',
                    'استقبل تنبيهات عندما تحتاج المنتجات إلى إعادة التخزين.',
                  ),
                  notifications.inventory,
                  (checked) =>
                    setNotifications((current) => ({
                      ...current,
                      inventory: checked,
                    })),
                )}

                {renderToggle(
                  t('Team activity', 'نشاط الفريق'),
                  t(
                    'Get updates about team member activity.',
                    'تابع التحديثات المتعلقة بنشاط أعضاء الفريق.',
                  ),
                  notifications.team,
                  (checked) =>
                    setNotifications((current) => ({
                      ...current,
                      team: checked,
                    })),
                )}

                {renderToggle(
                  t('Reports ready', 'جاهزية التقارير'),
                  t(
                    'Get notified when a report is ready to review.',
                    'احصل على إشعار عندما يصبح التقرير جاهزًا للمراجعة.',
                  ),
                  notifications.reports,
                  (checked) =>
                    setNotifications((current) => ({
                      ...current,
                      reports: checked,
                    })),
                )}

                {renderToggle(
                  t('Email notifications', 'إشعارات البريد الإلكتروني'),
                  t(
                    'Receive selected notifications by email.',
                    'استقبل الإشعارات المحددة عبر البريد الإلكتروني.',
                  ),
                  notifications.email,
                  (checked) =>
                    setNotifications((current) => ({
                      ...current,
                      email: checked,
                    })),
                )}
              </section>

              <div className="settings-save-row">
                <span>
                  {t(
                    'Choose what matters to your workflow.',
                    'اختر الإشعارات المناسبة لسير عملك.',
                  )}
                </span>

                <button className="settings-save-btn" type="submit">
                  {t('Save preferences', 'حفظ التفضيلات')} <span>↗</span>
                </button>
              </div>
            </form>
          )}

          {/* SECURITY */}
          {activeSection === 'Security' && (
            <>
              <section className="settings-panel">
                <div className="settings-panel-heading">
                  <div className="settings-panel-icon">◇</div>
                  <div>
                    <h3>{t('Account security', 'أمان الحساب')}</h3>
                    <p>
                      {t(
                        'Manage two-factor authentication for your account.',
                        'أدر المصادقة الثنائية لحماية حسابك.',
                      )}
                    </p>
                  </div>
                </div>

                {twoFactorError && (
                  <div className="settings-message" role="alert">
                    {twoFactorError}
                  </div>
                )}

                {twoFactorMessage && (
                  <div className="settings-message" role="status">
                    ✓ {twoFactorMessage}
                  </div>
                )}

                <div className="settings-toggle-row">
                  <div className="settings-toggle-copy">
                    <strong>
                      {t('Two-factor authentication', 'المصادقة الثنائية')}
                    </strong>
                    <p>
                      {twoFactorLoading
                        ? t(
                            'Loading security status...',
                            'جارٍ تحميل حالة الأمان...',
                          )
                        : twoFactorEnabled
                          ? t(
                              'Your account requires an authenticator code when signing in.',
                              'حسابك يتطلب رمز المصادقة عند تسجيل الدخول.',
                            )
                          : t(
                              'Add another verification step when signing in.',
                              'أضف خطوة تحقق إضافية عند تسجيل الدخول.',
                            )}
                    </p>
                  </div>

                  <span className="settings-section-badge">
                    {twoFactorEnabled
                      ? t('Enabled', 'مفعّلة')
                      : t('Disabled', 'غير مفعّلة')}
                  </span>
                </div>

                {!twoFactorEnabled && !twoFactorSetup && (
                  <div className="settings-save-row">
                    <span>
                      {t(
                        'Use an authenticator app to protect your account.',
                        'استخدم تطبيق مصادقة لحماية حسابك.',
                      )}
                    </span>

                    <button
                      className="settings-save-btn"
                      type="button"
                      disabled={twoFactorLoading}
                      onClick={() => void startTwoFactorSetup()}
                    >
                      {twoFactorLoading
                        ? t('Please wait...', 'يرجى الانتظار...')
                        : t('Set up 2FA', 'إعداد المصادقة الثنائية')}
                    </button>
                  </div>
                )}

                {/* QR SETUP */}
                {twoFactorSetup && !twoFactorEnabled && (
                  <div className="settings-2fa-setup">
                    <h3>{t('1. Scan the QR code', '١. امسح رمز QR')}</h3>

                    <p>
                      {t(
                        'Open an authenticator app, such as Google Authenticator or Microsoft Authenticator, and scan this code.',
                        'افتح تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator وامسح الرمز.',
                      )}
                    </p>

                    <img
                      className="settings-2fa-qr"
                      src={twoFactorSetup.qrCodeDataUrl}
                      alt={t(
                        'Two-factor setup QR code',
                        'رمز QR لإعداد المصادقة الثنائية',
                      )}
                    />

                    <p>
                      {t(
                        'Can’t scan it? Enter this setup key manually:',
                        'لا تستطيع مسحه؟ أدخل مفتاح الإعداد يدويًا:',
                      )}
                    </p>

                    <code className="settings-2fa-manual-key">
                      {twoFactorSetup.manualEntryKey}
                    </code>

                    <h3>
                      {t(
                        '2. Verify your authenticator',
                        '٢. تحقّق من تطبيق المصادقة',
                      )}
                    </h3>

                    <form onSubmit={confirmTwoFactorSetup}>
                      {renderVerificationCodeField(
                        t(
                          '6-digit verification code',
                          'رمز التحقق المكوّن من ٦ أرقام',
                        ),
                      )}

                      <div className="settings-save-row">
                        <button
                          className="settings-save-btn"
                          type="submit"
                          disabled={
                            twoFactorLoading || twoFactorCode.length !== 6
                          }
                        >
                          {twoFactorLoading
                            ? t('Verifying...', 'جارٍ التحقق...')
                            : t('Verify and enable', 'تحقّق وفعّل')}
                        </button>

                        <button
                          className="settings-cancel-btn"
                          type="button"
                          disabled={twoFactorLoading}
                          onClick={() => {
                            setTwoFactorSetup(null);
                            setTwoFactorCode('');
                            setTwoFactorError('');
                          }}
                        >
                          {t('Cancel', 'إلغاء')}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ENABLED */}
                {twoFactorEnabled && (
                  <>
                    <div className="settings-security-notice">
                      <span>i</span>
                      {t(
                        `Two-factor authentication is active. Recovery codes remaining: ${remainingRecoveryCodes}.`,
                        `المصادقة الثنائية مفعّلة. رموز الاسترداد المتبقية: ${remainingRecoveryCodes}.`,
                      )}
                    </div>

                    <form onSubmit={regenerateRecoveryCodes}>
                      <div className="settings-form-grid">
                        {renderVerificationCodeField(
                          t(
                            'Authenticator code to generate new recovery codes',
                            'رمز المصادقة لإنشاء رموز استرداد جديدة',
                          ),
                        )}
                      </div>

                      <div className="settings-save-row">
                        <span>
                          {t(
                            'Generating new codes replaces the previous recovery codes.',
                            'إنشاء رموز جديدة يستبدل رموز الاسترداد السابقة.',
                          )}
                        </span>

                        <button
                          className="settings-save-btn"
                          type="submit"
                          disabled={
                            twoFactorLoading || twoFactorCode.length !== 6
                          }
                        >
                          {t(
                            'Generate recovery codes',
                            'إنشاء رموز الاسترداد',
                          )}
                        </button>
                      </div>
                    </form>

                    <form onSubmit={disableTwoFactor}>
                      <div className="settings-form-grid">
                        {renderField(
                          t('Account password', 'كلمة مرور الحساب'),
                          twoFactorPassword,
                          setTwoFactorPassword,
                          '',
                          'password',
                        )}

                        {renderVerificationCodeField(
                          t('Authenticator code', 'رمز المصادقة'),
                        )}
                      </div>

                      <div className="settings-save-row">
                        <span>
                          {t(
                            'Your password and current authenticator code are required.',
                            'يلزم إدخال كلمة المرور ورمز المصادقة الحالي.',
                          )}
                        </span>

                        <button
                          className="settings-cancel-btn"
                          type="submit"
                          disabled={
                            twoFactorLoading ||
                            !twoFactorPassword ||
                            twoFactorCode.length !== 6
                          }
                        >
                          {t('Disable 2FA', 'إيقاف المصادقة الثنائية')}
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {/* RECOVERY CODES */}
                {recoveryCodes.length > 0 && (
                  <div className="settings-2fa-recovery">
                    <h3>
                      {t('Save your recovery codes', 'احفظ رموز الاسترداد')}
                    </h3>

                    <p>
                      {t(
                        'Each code can be used once if you cannot access your authenticator. Save these codes somewhere safe.',
                        'يمكن استخدام كل رمز مرة واحدة إذا لم تتمكن من الوصول إلى تطبيق المصادقة. احفظ الرموز في مكان آمن.',
                      )}
                    </p>

                    <div className="settings-2fa-recovery-list">
                      {recoveryCodes.map((code) => (
                        <code key={code}>{code}</code>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="settings-save-btn"
                      onClick={downloadRecoveryCodes}
                    >
                      {t(
                        'Download recovery codes',
                        'تنزيل رموز الاسترداد',
                      )}
                    </button>
                  </div>
                )}
              </section>

              {/* PASSWORD */}
              <form onSubmit={handlePasswordChange}>
                <section className="settings-panel settings-password-panel">
                  <div className="settings-panel-heading">
                    <div className="settings-panel-icon">⌑</div>
                    <div>
                      <h3>{t('Change password', 'تغيير كلمة المرور')}</h3>
                      <p>
                        {t(
                          'Use a strong password with at least 8 characters.',
                          'استخدم كلمة مرور قوية لا تقل عن 8 أحرف.',
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="settings-password-fields">
                    {renderField(
                      t('Current password', 'كلمة المرور الحالية'),
                      passwords.current,
                      (value) =>
                        setPasswords((current) => ({
                          ...current,
                          current: value,
                        })),
                      t('Enter current password', 'أدخل كلمة المرور الحالية'),
                      'password',
                    )}

                    {renderField(
                      t('New password', 'كلمة المرور الجديدة'),
                      passwords.next,
                      (value) =>
                        setPasswords((current) => ({
                          ...current,
                          next: value,
                        })),
                      t('Enter new password', 'أدخل كلمة المرور الجديدة'),
                      'password',
                    )}

                    {renderField(
                      t('Confirm new password', 'تأكيد كلمة المرور الجديدة'),
                      passwords.confirm,
                      (value) =>
                        setPasswords((current) => ({
                          ...current,
                          confirm: value,
                        })),
                      t('Repeat new password', 'أعد إدخال كلمة المرور الجديدة'),
                      'password',
                    )}
                  </div>

                  <div className="settings-save-row">
                    <span>
                      {t(
                        'Password updates need server-side authentication.',
                        'تغيير كلمة المرور يتطلب المصادقة عبر الخادم.',
                      )}
                    </span>

                    <button className="settings-save-btn" type="submit">
                      {t('Validate form', 'التحقق من النموذج')} <span>↗</span>
                    </button>
                  </div>
                </section>
              </form>
            </>
          )}

          {/* PREFERENCES */}
          {activeSection === 'Preferences' && (
            <form onSubmit={handleSave}>
              <section className="settings-panel">
                <div className="settings-panel-heading">
                  <div className="settings-panel-icon">⚙</div>
                  <div>
                    <h3>{t('Regional preferences', 'التفضيلات الإقليمية')}</h3>
                    <p>
                      {t(
                        'Set the language, time zone, and formats used in NEXA.',
                        'حدد اللغة والمنطقة الزمنية والتنسيقات المستخدمة في NEXA.',
                      )}
                    </p>
                  </div>
                </div>

                <div className="settings-form-grid">
                  {renderSelect(
                    t('Language', 'اللغة'),
                    settings.language,
                    ['English', 'العربية'],
                    (value) => updateSetting('language', value),
                  )}

                  {renderSelect(
                    t('Time zone', 'المنطقة الزمنية'),
                    settings.timezone,
                    [
                      'Asia/Amman',
                      'Asia/Riyadh',
                      'Asia/Dubai',
                      'Europe/London',
                      'America/New_York',
                    ],
                    (value) => updateSetting('timezone', value),
                  )}

                  {renderSelect(
                    t('Currency', 'العملة'),
                    settings.currency,
                    ['JOD', 'USD', 'EUR', 'SAR', 'AED'],
                    (value) => updateSetting('currency', value),
                  )}

                  {renderSelect(
                    t('Date format', 'تنسيق التاريخ'),
                    settings.dateFormat,
                    ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
                    (value) => updateSetting('dateFormat', value),
                  )}
                </div>

                <div className="settings-security-notice">
                  <span>i</span>
                  {t(
                    'These preferences currently affect this form only. Applying them across every page comes later.',
                    'تؤثر هذه التفضيلات حاليًا على هذا النموذج فقط. وسيتم تعميمها على جميع الصفحات لاحقًا.',
                  )}
                </div>
              </section>

              <div className="settings-save-row">
                <span>
                  {t(
                    'Choose formats that suit your business.',
                    'اختر التنسيقات المناسبة لنشاطك التجاري.',
                  )}
                </span>

                <button className="settings-save-btn" type="submit">
                  {t('Save preferences', 'حفظ التفضيلات')} <span>↗</span>
                </button>
              </div>
            </form>
          )}

          <div className="settings-bottom-note">
            <span className="settings-bottom-dot" />
            <span>NEXA Workspace</span>
            <span className="settings-bottom-separator">•</span>
            <span>
              {t(
                'Settings are currently stored in page state only.',
                'الإعدادات محفوظة في حالة الصفحة الحالية فقط.',
              )}
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
