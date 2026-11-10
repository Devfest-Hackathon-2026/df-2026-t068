"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  subscribeToProject,
  subscribeToProjects,
  type Project,
} from "@/lib/projects";
import styles from "./projects.module.css";
import { AnalysisWorkspace } from "./analysis-workspace";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    return subscribeToProject(
      user.uid,
      projectId,
      (nextProject) => {
        setProject(nextProject);
        setIsLoading(false);
      },
      () => {
        setError("プロジェクトを読み込めませんでした。");
        setIsLoading(false);
      },
    );
  }, [projectId, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(user.uid, setProjects, () => undefined);
  }, [user]);

  if (isAuthLoading || isLoading) {
    return <main className={styles.detailState}>プロジェクトを読み込んでいます</main>;
  }

  if (!user) {
    return (
      <main className={styles.detailState}>
        <p>プロジェクトを開くにはログインが必要です。</p>
        <Link href="/">ログイン画面へ戻る</Link>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className={styles.detailState}>
        <p>{error ?? "プロジェクトが見つかりませんでした。"}</p>
        <Link href="/">一覧へ戻る</Link>
      </main>
    );
  }

  return (
    <AnalysisWorkspace
      key={`${user.uid}-${projectId}`}
      project={project}
      projectId={projectId}
      projects={projects.length > 0 ? projects : [project]}
      user={user}
    />
  );
}
