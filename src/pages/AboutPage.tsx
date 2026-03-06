/**
 * AboutPage.tsx
 * About the app and creator – Beka Abesadze. Helps search engines associate the site with the developer.
 */

import styles from "./AboutPage.module.css";

export function AboutPage() {
  return (
    <article className={styles.page} aria-labelledby="about-heading">


      <section className={styles.creatorCard} aria-labelledby="creator-heading">
        <div className={styles.creatorVisual}>
          <img
            src="/bekapfp1.jpg"
            alt="Beka Abesadze"
            className={styles.avatar}
            width={200}
            height={200}
          />
        </div>
        <div className={styles.creatorContent}>
          <h2 id="creator-heading" className={styles.creatorName}>Beka Abesadze</h2>
          <p className={styles.creatorRole}>Creator & Full‑Stack Developer</p>
          <p className={styles.creatorBio}>
            This application was designed and built by Beka Abesadze—frontend, backend API, and
            data pipeline—for bank analytics and reporting.
          </p>
          <ul className={styles.links}>
            <li>
              <span className={styles.label}>Email</span>
              <a href="mailto:bekaabesadze007@gmail.com" className={styles.link}>
                bekaabesadze007@gmail.com
              </a>
            </li>
            <li>
              <span className={styles.label}>LinkedIn</span>
              <a
                href="https://www.linkedin.com/in/beka-abesadze-2387a0287/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                linkedin.com/in/beka-abesadze
              </a>
            </li>
          </ul>
        </div>
      </section>
    </article>
  );
}
