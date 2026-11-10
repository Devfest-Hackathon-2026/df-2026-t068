"use client";

import { useAuth } from "@/components/auth-provider";
import { ProjectList } from "@/components/project-list";
import styles from "./page.module.css";

export default function Home() {
  const {
    user,
    isLoading,
    missingConfiguration,
    error,
    signInWithGoogle,
    signOut,
  } = useAuth();

  if (isLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          ログイン状態を確認しています
        </div>
      </main>
    );
  }

  if (missingConfiguration.length > 0) {
    return (
      <main className={styles.page}>
        <section className={styles.setupCard} aria-labelledby="setup-title">
          <p className={styles.eyebrow}>SETUP REQUIRED</p>
          <h1 id="setup-title">Firebaseの接続設定が必要です</h1>
          <p>
            <code>.env.local</code>を作成し、次の環境変数を設定してください。
          </p>
          <ul className={styles.configList}>
            {missingConfiguration.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  if (user) {
    return <ProjectList authError={error} onSignOut={signOut} user={user} />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.loginCard}>
        <div className={styles.brandMark} aria-hidden="true">
          IW
        </div>
        <p className={styles.eyebrow}>IDEAWEAVE</p>
        <h1>アイデアの接点を見つける</h1>
        <p className={styles.lead}>
          複数のアイデアを整理し、チームで共通する目的や価値を見つけます。
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button
          className={styles.googleButton}
          type="button"
          onClick={signInWithGoogle}
        >
          <span className={styles.googleMark} aria-hidden="true">
            G
          </span>
          Googleでログイン
        </button>
        <p className={styles.note}>
          ログインすると、自分のプロジェクトを端末をまたいで利用できます。
        </p>
      </section>
    </main>
  );
}
