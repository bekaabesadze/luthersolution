/**
 * TermsPage.tsx
 * Terms of Service for Competitor Bank Analytics. Required for trust and compliance.
 */

import styles from "./LegalPage.module.css";

export function TermsPage() {
  return (
    <article className={styles.legalPage} aria-labelledby="terms-heading">
      <header className={styles.legalHero}>
        <h1 id="terms-heading" className={styles.legalTitle}>Terms of Service</h1>
        <p className={styles.legalUpdated}>Last updated: February 2025</p>
      </header>

      <div className={styles.legalCard}>
        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>1. Acceptance of Terms</h2>
          <p className={styles.legalBody}>
            By accessing or using Competitor Bank Analytics (“CBA,” “the Service”), you agree to these Terms of Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>2. Use of the Service</h2>
          <p className={styles.legalBody}>
            The Service is provided for internal business use to analyze and report on bank performance data. You agree to:
          </p>
          <ul className={styles.legalList}>
            <li>Use the Service only for lawful purposes and in compliance with your organization’s policies</li>
            <li>Upload only data you are authorized to use and that does not violate third-party rights</li>
            <li>Not attempt to gain unauthorized access to the Service, other users’ data, or our systems</li>
            <li>Not use the Service to distribute malware or engage in abuse or fraud</li>
          </ul>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>3. Intellectual Property</h2>
          <p className={styles.legalBody}>
            The Service, including its design, code, and documentation, is owned by us or our licensors. You retain rights to the data you upload. We do not claim ownership of your content but may use it to operate and improve the Service as described in our Privacy Policy.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>4. Data and Accuracy</h2>
          <p className={styles.legalBody}>
            You are responsible for the accuracy of data you upload. We are not liable for decisions made based on reports or dashboards generated from your data. The Service is provided “as is” for analytical support only.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>5. Security and Availability</h2>
          <p className={styles.legalBody}>
            We implement reasonable security measures to protect the Service and your data. We do not guarantee uninterrupted availability and may perform maintenance or updates with or without notice.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>6. Limitation of Liability</h2>
          <p className={styles.legalBody}>
            To the extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability is limited to the amount (if any) you paid to use the Service in the twelve months prior to the claim.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>7. Termination</h2>
          <p className={styles.legalBody}>
            We may suspend or terminate your access to the Service for violation of these Terms or for operational reasons. You may stop using the Service at any time. Upon termination, your right to access the Service ceases; data retention is governed by our Privacy Policy.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2 className={styles.legalSectionTitle}>8. Changes to the Terms</h2>
          <p className={styles.legalBody}>
            We may update these Terms from time to time. The “Last updated” date at the top will be revised when changes are made. Continued use of the Service after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className={`${styles.legalSection} ${styles.legalContact}`}>
          <h2 className={styles.legalSectionTitle}>9. Contact</h2>
          <p className={styles.legalBody}>
            For questions about these Terms of Service, contact Beka Abesadze at{" "}
            <a href="mailto:bekaabesadze007@gmail.com" className={styles.legalLink}>bekaabesadze007@gmail.com</a> or via{" "}
            <a href="https://www.linkedin.com/in/beka-abesadze-2387a0287/" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>LinkedIn</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
