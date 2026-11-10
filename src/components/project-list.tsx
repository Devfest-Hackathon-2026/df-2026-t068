"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  createProject,
  subscribeToProjects,
  type Project,
} from "@/lib/projects";
import styles from "./projects.module.css";

const statusLabels = {
  draft: "入力待ち",
  analyzing: "解析中",
  ready: "解析済み",
  error: "要確認",
} as const;

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

type ProjectListProps = {
  user: User;
  authError: string | null;
  onSignOut: () => Promise<void>;
};

export function ProjectList({ user, authError, onSignOut }: ProjectListProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const displayName = user.displayName ?? user.email ?? "ユーザー";
  const initial = useMemo(() => displayName.slice(0, 1).toUpperCase(), [displayName]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    return subscribeToProjects(
      user.uid,
      (nextProjects) => {
        setProjects(nextProjects);
        setIsLoading(false);
      },
      () => {
        setError("プロジェクト一覧を読み込めませんでした。");
        setIsLoading(false);
      },
    );
  }, [user.uid]);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = projectName.trim();

    if (!normalizedName) {
      setCreateError("プロジェクト名を入力してください。");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const projectId = await createProject(user.uid, normalizedName);
      setProjectName("");
      setIsCreateOpen(false);
      router.push(`/projects/${projectId}`);
    } catch {
      setCreateError("プロジェクトを作成できませんでした。もう一度お試しください。");
    } finally {
      setIsCreating(false);
    }
  }

  function openCreateDialog() {
    setProjectName("");
    setCreateError(null);
    setIsCreateOpen(true);
  }

  return (
    <div className={`${styles.shell} ${styles.listShell}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark} aria-hidden="true">IW</span>
            <span>IdeaWeave</span>
          </Link>
        </div>

        <nav className={styles.sidebarNav} aria-label="プロジェクトナビゲーション">
          <p className={styles.sidebarTitle}>プロジェクト</p>
          <ul className={styles.sidebarProjects}>
            {projects.map((project) => (
              <li key={project.id}>
                <Link className={styles.sidebarProjectLink} href={`/projects/${project.id}`}>
                  <span>{project.name}</span>
                  <span className={styles.sidebarProjectArrow} aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{initial}</span>
            <span className={styles.accountName}>{displayName}</span>
          </div>
          <button className={styles.signOutButton} type="button" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.heading}>
          <h1>プロジェクト一覧</h1>
          <button className={styles.createButton} type="button" onClick={openCreateDialog}>
            <span aria-hidden="true">＋</span>
            新規プロジェクト
          </button>
        </div>

        {authError || error ? (
          <p className={styles.errorMessage} role="alert">{authError ?? error}</p>
        ) : null}

        {isLoading ? (
          <div className={styles.state} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            プロジェクトを読み込んでいます
          </div>
        ) : null}

        {!isLoading && !error && projects.length === 0 ? (
          <section className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">＋</div>
            <h2>プロジェクトはまだありません</h2>
            <button className={styles.emptyCreateButton} type="button" onClick={openCreateDialog}>
              プロジェクトを作成
            </button>
          </section>
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <ul className={styles.projectGrid}>
            {projects.map((project) => (
              <li key={project.id}>
                <Link className={styles.projectCard} href={`/projects/${project.id}`}>
                  <h2>{project.name}</h2>
                  <div className={styles.projectMeta}>
                    <span className={`${styles.status} ${styles[project.status]}`}>
                      {statusLabels[project.status]}
                    </span>
                    <span className={styles.updatedAt}>
                      更新日時：{project.updatedAt ? dateFormatter.format(project.updatedAt) : "保存処理中"}
                    </span>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      {isCreateOpen ? (
        <div className={styles.dialogBackdrop}>
          <section
            aria-labelledby="create-project-title"
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <div className={styles.dialogHeading}>
              <div>
                <p className={styles.eyebrow}>NEW PROJECT</p>
                <h2 id="create-project-title">新規プロジェクト</h2>
              </div>
              <button
                aria-label="閉じる"
                className={styles.closeButton}
                disabled={isCreating}
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <label className={styles.fieldLabel} htmlFor="project-name">
                プロジェクト名
              </label>
              <input
                autoFocus
                className={styles.textInput}
                disabled={isCreating}
                id="project-name"
                maxLength={60}
                placeholder="例：地域課題アイデア会議"
                required
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
              <div className={styles.inputMeta}>{projectName.length} / 60</div>
              {createError ? (
                <p className={styles.errorMessage} role="alert">{createError}</p>
              ) : null}
              <div className={styles.dialogActions}>
                <button
                  className={styles.cancelButton}
                  disabled={isCreating}
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  キャンセル
                </button>
                <button className={styles.submitButton} disabled={isCreating} type="submit">
                  {isCreating ? "作成しています" : "作成する"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
