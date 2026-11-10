import type { WorkspaceSnapshot } from "@/features/workspace/types";

// 分析APIが接続されるまで使う表示確認用データ。Firestoreやalgorithm/には依存しない。
export function createMockWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    source: "mock",
    ideas: [
      {
        id: "idea-shopping",
        title: "高齢者の買い物支援",
        originalText: "地域の高齢者が日用品を無理なく購入できる仕組みをつくる。",
        color: "#7f8fd4",
      },
      {
        id: "idea-transport",
        title: "地域交通の再設計",
        originalText: "予約に応じて走る小型車両で、交通空白地域の移動を支える。",
        color: "#6aa99a",
      },
      {
        id: "idea-vendor",
        title: "移動販売の共同運営",
        originalText: "複数店舗が共同で移動販売を運営し、地域を定期巡回する。",
        color: "#b38a67",
      },
    ],
    concepts: [
      { id: "idea-shopping", kind: "idea", ideaId: "idea-shopping", label: "高齢者の買い物支援", description: "買い物へのアクセスを地域で支える案。", evidence: "地域の高齢者が日用品を無理なく購入できる仕組み", inferred: false },
      { id: "shopping-problem", kind: "perspective", ideaId: "idea-shopping", parentId: "idea-shopping", label: "課題", perspective: "課題", description: "店舗までの移動が負担になっている。", evidence: "高齢者が日用品を無理なく購入", inferred: true },
      { id: "shopping-access", kind: "factor", ideaId: "idea-shopping", parentId: "shopping-problem", label: "店舗へのアクセス", perspective: "課題", description: "日用品を扱う店舗へ到達しにくい。", evidence: "日用品を無理なく購入できる仕組み", inferred: true },
      { id: "shopping-community", kind: "factor", ideaId: "idea-shopping", parentId: "shopping-problem", label: "地域の支援体制", perspective: "価値", description: "個人ではなく地域単位で生活を支える。", evidence: "地域の高齢者", inferred: false },

      { id: "idea-transport", kind: "idea", ideaId: "idea-transport", label: "地域交通の再設計", description: "需要に合わせて動く地域交通の案。", evidence: "予約に応じて走る小型車両", inferred: false },
      { id: "transport-function", kind: "perspective", ideaId: "idea-transport", parentId: "idea-transport", label: "機能", perspective: "機能", description: "必要な時間と場所に移動手段を提供する。", evidence: "予約に応じて走る", inferred: false },
      { id: "transport-demand", kind: "factor", ideaId: "idea-transport", parentId: "transport-function", label: "オンデマンド運行", perspective: "機能", description: "固定路線ではなく予約に合わせて運行する。", evidence: "予約に応じて走る小型車両", inferred: false },
      { id: "transport-gap", kind: "factor", ideaId: "idea-transport", parentId: "transport-function", label: "交通空白の解消", perspective: "目的", description: "既存交通が届かない地域を補完する。", evidence: "交通空白地域の移動を支える", inferred: false },

      { id: "idea-vendor", kind: "idea", ideaId: "idea-vendor", label: "移動販売の共同運営", description: "複数店舗で移動販売を持続させる案。", evidence: "複数店舗が共同で移動販売を運営", inferred: false },
      { id: "vendor-structure", kind: "perspective", ideaId: "idea-vendor", parentId: "idea-vendor", label: "運営", perspective: "技術・運営", description: "複数の事業者で運営資源を共有する。", evidence: "複数店舗が共同で", inferred: false },
      { id: "vendor-sharing", kind: "factor", ideaId: "idea-vendor", parentId: "vendor-structure", label: "共同運営", perspective: "技術・運営", description: "車両や人員、仕入れを共同化する。", evidence: "共同で移動販売を運営", inferred: true },
      { id: "vendor-route", kind: "factor", ideaId: "idea-vendor", parentId: "vendor-structure", label: "定期巡回", perspective: "機能", description: "地域内の複数地点を決まった頻度で巡回する。", evidence: "地域を定期巡回する", inferred: false },
    ],
    relations: [
      { id: "h-shopping-problem", source: "idea-shopping", target: "shopping-problem", kind: "hierarchy" },
      { id: "h-shopping-access", source: "shopping-problem", target: "shopping-access", kind: "hierarchy" },
      { id: "h-shopping-community", source: "shopping-problem", target: "shopping-community", kind: "hierarchy" },
      { id: "h-transport-function", source: "idea-transport", target: "transport-function", kind: "hierarchy" },
      { id: "h-transport-demand", source: "transport-function", target: "transport-demand", kind: "hierarchy" },
      { id: "h-transport-gap", source: "transport-function", target: "transport-gap", kind: "hierarchy" },
      { id: "h-vendor-structure", source: "idea-vendor", target: "vendor-structure", kind: "hierarchy" },
      { id: "h-vendor-sharing", source: "vendor-structure", target: "vendor-sharing", kind: "hierarchy" },
      { id: "h-vendor-route", source: "vendor-structure", target: "vendor-route", kind: "hierarchy" },
      { id: "s-access-gap", source: "shopping-access", target: "transport-gap", kind: "semantic", reason: "どちらも、生活に必要な場所へ到達しにくい問題を扱っている。" },
      { id: "s-demand-route", source: "transport-demand", target: "vendor-route", kind: "semantic", reason: "地域内を巡回する移動サービスとして運行設計を共有できる。" },
      { id: "s-community-sharing", source: "shopping-community", target: "vendor-sharing", kind: "semantic", reason: "地域や複数事業者が資源を共同で支える運営構造に接点がある。" },
    ],
  };
}
