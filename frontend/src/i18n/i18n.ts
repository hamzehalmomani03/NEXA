import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      appName: 'NEXA',
      overview: 'Overview',
      products: 'Products',
      inventory: 'Inventory',
      sales: 'Sales',
      invoices: 'Invoices',
      customers: 'Customers',
      reports: 'Reports & Analytics',
      team: 'Team Members',
      settings: 'Settings',
      language: 'Change language',
      english: 'English',
      arabic: 'Arabic',
      logout: 'Sign out',
      search: 'Search',
      save: 'Save',
      cancel: 'Cancel',
      loading: 'Loading...',
      workspace: 'Workspace',
      businessAccount: 'Business account',
      management: 'Management',
      systemStatus: 'All systems operational',
      signedIn: 'Signed in',
      upgradeTitle: 'Unlock your potential',
      upgradeDescription: 'Get more insights and grow your business with NEXA.',
      exploreFeatures: 'Explore features',
      notifications: 'Notifications',
    },
  },
  ar: {
    translation: {
      appName: 'نيكسا',
      overview: 'نظرة عامة',
      products: 'المنتجات',
      inventory: 'المخزون',
      sales: 'المبيعات',
      invoices: 'الفواتير',
      customers: 'العملاء',
      reports: 'التقارير والتحليلات',
      team: 'أعضاء الفريق',
      settings: 'الإعدادات',
      language: 'تغيير اللغة',
      english: 'الإنجليزية',
      arabic: 'العربية',
      logout: 'تسجيل الخروج',
      search: 'بحث',
      save: 'حفظ',
      cancel: 'إلغاء',
      loading: 'جارٍ التحميل...',
      workspace: 'مساحة العمل',
      businessAccount: 'حساب تجاري',
      management: 'الإدارة',
      systemStatus: 'جميع الأنظمة تعمل بشكل طبيعي',
      signedIn: 'تم تسجيل الدخول',
      upgradeTitle: 'اكتشف إمكانياتك',
      upgradeDescription: 'احصل على رؤى أعمق وطوّر أعمالك مع نيكسا.',
      exploreFeatures: 'استكشف المزايا',
      notifications: 'الإشعارات',
    },
  },
};

const savedLanguage = localStorage.getItem('nexa_language');

void i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage === 'ar' ? 'ar' : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
