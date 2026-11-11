import { Link } from 'react-router-dom';

const sections = [
  {
    title: '1. Information We Collect',
    text: 'NEXA may process account information such as names, email addresses, authentication credentials, organization memberships, and business records entered into the platform, including products, inventory, sales, and customer information.',
  },
  {
    title: '2. How We Use Information',
    text: 'We use this information to operate NEXA, manage business workspaces, provide requested features, authenticate users, send account-related emails, and maintain service security.',
  },
  {
    title: '3. Google API Services',
    text: 'NEXA uses the Gmail API through an authorized application sender account to send password reset emails and organization invitations. NEXA does not currently provide a feature for customers to connect their personal Gmail accounts.',
  },
  {
    title: '4. Information Sharing',
    text: 'Information may be processed by service providers supporting the operation of NEXA, including hosting, database, and email providers. Information may also be disclosed when required by applicable law.',
  },
  {
    title: '5. Security',
    text: 'NEXA uses authentication, role-based access controls, and technical safeguards intended to protect account and business information. No online service can guarantee absolute security.',
  },
  {
    title: '6. Data Retention and Requests',
    text: 'Information may be retained as necessary to provide the service and meet applicable obligations. Users can contact us to request access, correction, or deletion of personal information, subject to applicable requirements.',
  },
  {
    title: '7. Changes to This Policy',
    text: 'We may update this Privacy Policy as our services or practices change. Updates will be published on this page.',
  },
];

export default function PrivacyPolicy() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#071611',
      color: '#e7f5ee',
      padding: '48px 20px',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 850, margin: '0 auto' }}>
        <Link to="/login" style={{
          color: '#34d399',
          textDecoration: 'none',
          fontWeight: 800,
          fontSize: 26,
        }}>
          NEXA.
        </Link>

        <h1 style={{ fontSize: 36, marginTop: 36 }}>
          Privacy Policy
        </h1>

        <p style={{ color: '#a4b9ae' }}>
          Effective date: November 11, 2026
        </p>

        <p style={{ lineHeight: 1.8 }}>
          This policy describes how NEXA handles information
          when users access its business management platform.
        </p>

        {sections.map((section) => (
          <section key={section.title} style={{
            padding: '22px 0',
            borderTop: '1px solid #234238',
          }}>
            <h2 style={{ color: '#34d399', fontSize: 20 }}>
              {section.title}
            </h2>
            <p style={{ lineHeight: 1.9, color: '#c7d8ce' }}>
              {section.text}
            </p>
          </section>
        ))}

        <section style={{
          padding: '22px 0',
          borderTop: '1px solid #234238',
        }}>
          <h2 style={{ color: '#34d399', fontSize: 20 }}>
            8. Contact
          </h2>
          <p>
            Privacy inquiries:
            {' '}
            <a
              href="mailto:hamzeh.almomani03@gmail.com"
              style={{ color: '#34d399' }}
            >
              hamzeh.almomani03@gmail.com
            </a>
          </p>
        </section>

        <footer style={{
          paddingTop: 24,
          borderTop: '1px solid #234238',
          color: '#a4b9ae',
        }}>
          © 2026 NEXA. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
