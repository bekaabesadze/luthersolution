/**
 * PrivacyPage.tsx
 * Privacy policy for Competitor Bank Analytics. Required for trust and compliance.
 */

import styles from "./LegalPage.module.css";

export function PrivacyPage() {
  return (
    <article className={styles.legalPage} aria-labelledby="privacy-heading">
      <header className={styles.legalHero}>
        <h1 id="privacy-heading" className={styles.legalTitle}>Privacy Policy</h1>
        <p className={styles.legalUpdated}>Last updated: February 2025</p>
      </header>

      <div className={styles.legalCard}>
        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>1. Overview</h2>
          <p className={styles.legalBody}>
            Competitor Bank Analytics (“CBA,” “we,” “our”) is an internal analytics tool. This Privacy Policy explains how we collect, use, and protect information when you use this service.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>2. Information We Collect</h2>
          <p className={styles.legalBody}>
            We may collect and store data you provide when using the service, including:
          </p>
          <ul className={styles.legalList}>
            <li>Uploaded files (e.g., XBRL, Excel) and associated metadata (bank name, year, quarter)</li>
            <li>Data you enter in the application (filters, report preferences)</li>
            <li>Technical data such as IP address and browser type when you access the service</li>
          </ul>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>3. How We Use Information</h2>
          <p className={styles.legalBody}>
            We use the information to operate the service, generate reports and dashboards, improve the application, and comply with legal obligations. We do not sell your data to third parties.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>4. Data Storage and Security</h2>
          <p className={styles.legalBody}>
            Data is stored on secure servers. We use industry-standard measures (including encryption in transit via HTTPS and access controls) to protect your data. Access is limited to authorized personnel.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>5. Data Retention</h2>
          <p className={styles.legalBody}>
            We retain uploaded data and metrics as needed for analytics and reporting. You can request deletion of specific uploads via the application or by contacting your administrator.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>6. Your Rights</h2>
          <p className={styles.legalBody}>
            Depending on your jurisdiction, you may have rights to access, correct, or delete your data. Contact your organization’s administrator or the data protection contact for requests.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>7. Cookies and Similar Technologies</h2>
          <p className={styles.legalBody}>
            We may use essential cookies and local storage to keep you logged in and remember preferences. We do not use third-party advertising or tracking cookies.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>8. Changes to This Policy</h2>
          <p className={styles.legalBody}>
            We may update this Privacy Policy from time to time. The “Last updated” date at the top will be revised when changes are made. Continued use of the service after changes constitutes acceptance.
          </p>
        </section>

        <section className={`${styles.legalSection} ${styles.legalContact}`}>
          <h2 className={styles.legalSectionTitle}>9. Contact</h2>
          <p className={styles.legalBody}>
            For questions about this Privacy Policy or our data practices, contact Beka Abesadze at{" "}
            <a href="mailto:bekaabesadze007@gmail.com" className={styles.legalLink}>bekaabesadze007@gmail.com</a> or via{" "}
            <a href="https://www.linkedin.com/in/beka-abesadze-2387a0287/" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>LinkedIn</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
