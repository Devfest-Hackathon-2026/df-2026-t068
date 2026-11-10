"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { IdeaMap } from "./idea-map";
import { ComparisonDetails } from "./comparison-details";
import { ideaConnections } from "@/lib/idea-connections";
import { connectionGroups } from "@/lib/map-groups";
import { emptyWorkspace, saveIdeas, saveAnalysis, savePositions, subscribeWorkspace, type Workspace } from "@/lib/workspace";
import { validateIdeas, type IdeaInput, type MapAnalysis, type MapPositions } from "@/lib/analysis-data";
import type { Project } from "@/lib/projects";
import styles from "./workspace.module.css";

export function AnalysisWorkspace({ user, projectId, project, projects }: { user: User; projectId: string; project: Project; projects: Project[] }) {
  const [ideas, setIdeas] = useState<IdeaInput[]>(emptyWorkspace.ideas);
  const [stored, setStored] = useState<Workspace>(emptyWorkspace);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState("保存済み");
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const dirty = useRef(false);
  const busyRef = useRef(false);
  const revision = useRef("");
  const signature = useRef("");
  const sequence = useRef(0);
  const queue = useRef<Promise<string>>(Promise.resolve(""));

  useEffect(() => subscribeWorkspace(user.uid, projectId, workspace => {
    setStored(workspace);
    if (!initialized.current || (!dirty.current && !busyRef.current)) {
      setIdeas(workspace.ideas);
      revision.current = workspace.revision;
      signature.current = JSON.stringify(workspace.ideas);
    }
    initialized.current = true;
    setLoaded(true);
  }, () => { setError("保存データを読み込めませんでした。接続を確認して再読み込みしてください。"); }), [user.uid, projectId]);

  const persist = useCallback((input: IdeaInput[], version: number) => {
    const text = JSON.stringify(input);
    queue.current = queue.current.catch(() => "").then(async () => {
      if (signature.current === text && revision.current) {
        if (sequence.current === version) { dirty.current = false; setSaveState("保存済み"); }
        return revision.current;
      }
      setSaveState("保存中…");
      const next = await saveIdeas(user.uid, projectId, input, revision.current);
      revision.current = next;
      signature.current = text;
      if (sequence.current === version) { dirty.current = false; setSaveState("保存済み"); }
      return next;
    });
    return queue.current;
  }, [user.uid, projectId]);

  useEffect(() => {
    if (!loaded || busy || !dirty.current) return;
    const version = sequence.current;
    const timer = setTimeout(() => {
      void persist(ideas, version).catch(cause => { setSaveState("保存できていません"); setError(cause instanceof Error ? cause.message : "保存に失敗しました。"); });
    }, 900);
    return () => clearTimeout(timer);
  }, [ideas, loaded, busy, persist]);

  function change(next: IdeaInput[]) {
    dirty.current = true; sequence.current += 1;
    setSaveState("未保存"); setIdeas(next); setError(null);
  }
  async function runAnalysis() {
    if (busyRef.current) return;
    try { validateIdeas(ideas); } catch (cause) { setError((cause as Error).message); return; }
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const currentRevision = await persist(ideas, sequence.current);
      const token = await user.getIdToken();
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ projectId, revision: currentRevision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "分析に失敗しました。");
      await saveAnalysis(user.uid, projectId, currentRevision, data.analysis as MapAnalysis);
      setStored(previous => ({ ...previous, ideas, analyzedIdeas: ideas, revision: currentRevision, analysisRevision: currentRevision, analysis: data.analysis, positions: {} }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "分析に失敗しました。もう一度お試しください。");
      if (dirty.current) setSaveState("保存できていません");
    } finally { busyRef.current = false; setBusy(false); }
  }
  function updatePositions(positions: MapPositions) {
    setStored(previous => ({ ...previous, positions }));
    void savePositions(user.uid, projectId, stored.analysisRevision, positions).catch(() => setError("マップの配置を保存できませんでした。分析結果は保持されています。"));
  }

  if (!loaded) return <p className={styles.loading} role={error ? "alert" : "status"}>{error ?? "ワークスペースを読み込んでいます…"}</p>;
  const stale = Boolean(stored.analysis && JSON.stringify(ideas) !== JSON.stringify(stored.analyzedIdeas));
  // The map always describes the analyzed inputs, even after the draft changes.
  const mapIdeas = stored.analyzedIdeas;
  const groups = stored.analysis ? stored.analysis.factors.flatMap(factor => connectionGroups(stored.analysis!, factor.id)) : [];
  return <>
    <header className={styles.workspaceViews}><Link href="/" className={styles.brand}>◈ <strong>IdeaWeave</strong></Link><span>{project.name}</span><small>IDEA WORKSPACE</small></header>
    <div className={styles.workspace}>
    <section className={styles.inputPanel} aria-labelledby="ideas-heading">
      <nav className={styles.projectNavigation} aria-label="プロジェクト"><p>PROJECTS</p>{projects.map(item=><Link href={`/projects/${item.id}`} key={item.id} aria-current={item.id===projectId?"page":undefined}><span>◇</span>{item.name}</Link>)}</nav>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>YOUR IDEAS</p><h2 id="ideas-heading">アイデアを持ち寄る</h2></div><span className={styles.saveState} role="status">{saveState}</span></div>
      <p className={styles.intro}>2〜5つの案を入力してください。課題や目的を整理して、案同士の接点を探します。</p>
      {ideas.map((idea, i) => <div className={styles.ideaCard} key={idea.id}>
        <div className={styles.ideaHeading}><label htmlFor={`idea-${idea.id}`}>アイデア {i + 1}</label>{ideas.length > 2 && <button type="button" disabled={busy} onClick={() => change(ideas.filter(v => v.id !== idea.id))} className={styles.textButton}>削除</button>}</div>
        <textarea id={`idea-${idea.id}`} value={idea.text} maxLength={6000} disabled={busy} onChange={e => change(ideas.map(v => v.id === idea.id ? { ...v, text: e.target.value } : v))} placeholder="誰の、どんな課題を、どう解決するアイデアですか？" rows={5} />
        <span className={styles.characterCount}>{idea.text.length.toLocaleString()} / 6,000</span>
      </div>)}
      <button className={styles.addButton} type="button" disabled={ideas.length >= 5 || busy} onClick={() => change([...ideas, { id: crypto.randomUUID(), text: "" }])}>＋ アイデアを追加</button>
      {error && <div role="alert" className={styles.error}>{error}<button type="button" className={styles.textButton} disabled={busy} onClick={() => { void persist(ideas, sequence.current).then(() => setError(null)).catch(cause => setError(cause.message)); }}>入力の保存を再試行</button></div>}
      <button className={styles.analyzeButton} type="button" disabled={busy || ideas.some(i => !i.text.trim())} onClick={() => void runAnalysis()}>{busy ? "接点を分析しています…" : stored.analysis ? "もう一度分析する" : "アイデアをマッピング"}<span aria-hidden="true"> ↗</span></button>
      <p className={styles.hint}>{busy ? "入力は保存済みです。そのままお待ちください。" : "入力は自動保存されます。分析はボタンを押したときだけ実行します。"}</p>
    </section>
    <section className={styles.mapPanel} aria-labelledby="map-heading">
      <div className={styles.mapHeading}><div><p className={styles.eyebrow}>DISCOVER CONNECTIONS</p><h2 id="map-heading">アイデアのつながり</h2></div><span className={styles.mapBadge}>{stored.analysis ? `${ideaConnections(stored.analysis).reduce((sum, link) => sum + link.factors.length, 0)} の接点` : "まだ分析されていません"}</span></div>
      {stale && <p className={styles.stale} role="status">入力が変更されています。前回のマップを表示中です。再分析すると更新されます。</p>}
      {stored.analysis && stored.analysis.values.some(value => !("broaderConcept" in value)) && <p className={styles.stale} role="status">これは上位概念対応前の結果です。「もう一度分析する」で、全因数の上位概念も調べられます。固定の分類表によるリンクは表示しません。</p>}
      {stored.analysis && stored.analysis.configVersion !== "single-value-6-semantic" && <p className={styles.stale}>前回の分析結果です。共通原理の検出とラベルの意味確認を反映するには、もう一度分析してください。全体マップはこの結果でも確認できます。</p>}
      {stored.analysis ? <>
        <div className={styles.legend}><span>緑：意味が近い</span><span>橙：上位概念が近い</span><span>同じ因数の具体値と上位概念は重複して数えません</span></div>
        <IdeaMap key={`map-${stored.analysisRevision}`} analysis={stored.analysis} ideas={mapIdeas} positions={stored.positions} onPositions={updatePositions} />
        <div className={styles.connections}><h3>見つかった共通部分</h3>{groups.length === 0 && <p>現在の基準で共通する値は見つかりませんでした。</p>}{groups.map(group => {
          const members = group.memberIds.map(id => stored.analysis!.values.find(value => value.id === id)!);
          return <div className={`${styles.connection} ${group.kind === "broader-concept" ? styles.partialConnection : ""}`} key={group.id}><span>{stored.analysis!.factors.find(factor => factor.id === group.factorId)?.name}{group.kind === "broader-concept" ? " · 上位概念" : ""}</span><strong>{group.label}</strong>{members.map(value => <p key={value.id}>アイデア {mapIdeas.findIndex(idea => idea.id === value.ideaId) + 1}：{value.label}</p>)}{group.kind === "broader-concept" ? <small>AIが抽象化した上位概念の関連候補です</small> : members.some(value => value.inferred) && <small>AIの推測を含みます</small>}</div>;
        })}</div>
        <ComparisonDetails key={`comparison-${stored.analysisRevision}`} analysis={stored.analysis} ideas={mapIdeas} />
      </> : <div className={styles.emptyMap}><div className={styles.emptyGraphic} aria-hidden="true"><span>IDEA 01</span><i /><span>共通する意味</span><i /><span>IDEA 02</span></div><h3>別々の案に、共通する視点を。</h3><p>アイデアを入力して分析すると、ターゲット・課題・原因・目的・解決原理・利用場面がここに並びます。</p></div>}
    </section>
  </div>
  </>;
}
