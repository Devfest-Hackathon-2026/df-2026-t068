"use client";

import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@/features/workspace/types";
import styles from "./workspace.module.css";

export function ConceptNode({ data, selected }: NodeProps) {
  const concept = data as GraphNodeData;
  const style = { "--concept-color": concept.color } as CSSProperties;

  return (
    <div
      className={`${styles.conceptNode} ${styles[concept.kind]} ${selected ? styles.selectedNode : ""}`}
      style={style}
      title={concept.label}
    >
      <Handle className={styles.nodeHandle} position={Position.Top} type="target" />
      <span className={styles.nodeOrb}>
        {concept.kind !== "factor" ? <strong>{concept.label}</strong> : null}
      </span>
      {concept.kind === "factor" ? <strong className={styles.outerLabel}>{concept.label}</strong> : null}
      {concept.pinned ? <span className={styles.pinMark} aria-label="位置を固定中">●</span> : null}
      <Handle className={styles.nodeHandle} position={Position.Bottom} type="source" />
    </div>
  );
}
