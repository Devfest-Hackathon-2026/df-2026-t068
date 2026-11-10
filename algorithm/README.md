最新の全体マップ・共通ラベル確認・比較方式・しきい値調整は [MAP_AND_LABEL_REVIEW.md](MAP_AND_LABEL_REVIEW.md) を参照してください。

> 現行仕様は [ABSTRACTION.md](ABSTRACTION.md) を参照してください。固定の対象分類表は廃止し、全因数の上位概念をLLMで抽出・Embeddingで比較します。

# IdeaWeave 分析アルゴリズム

Next.jsのサーバー処理から利用するTypeScriptモジュールです。画面、認証、Firestore、デプロイには依存しません。Google Cloud接続には公式SDK（@google/genai）を使います。Node.js 22.18以上（動作確認は24.22）を使います。ブラウザのコードからGoogleProviderを呼ばないでください。

## API消費なしで再評価する

`npm run replay -- --threshold=0.7`で保存済みの結果を再計算できます。ネットワーク・AI APIは使いません。新しい入力を解析する`npm run try`は引き続きAPIを使用します。改善の仕組みと制限は[ALGORITHM_NOTES.md](ALGORITHM_NOTES.md)を参照してください。

## 端末で2案を入力してテストする

開発フォルダで次を実行します。各案は1行で入力し、Enterで確定してください。

```powershell
npm run try
```

APIなしで操作だけ確認する固定例は`npm run try:mock`です。モックは任意の文章を正しく解析するものではありません。

因数分解結果、原文の根拠、推測区分、同じ因数間の全類似度、近いと判断した共通部分、平均ベクトルによる暫定ラベルと候補順位を端末に表示します。既定のしきい値0.82は未調整なので、関連なしになる場合があります。値は確率ではありません。

しきい値をその実行だけ変える例：

```powershell
npm run try -- --threshold=0.7
```

標準入力は2行（1行1案）です。ファイルからの入力にも対応します。案内と進捗は標準エラー、結果は標準出力へ出します。入力した案と詳細結果は`output/interactive-analysis.json`、日本語レポートは`output/interactive-report.txt`に保存されます（実行のたび上書き）。エラー時は非ゼロで終了します。

### 新しい出力形式

`decompositions`には、案ごとに以下のような`factors`が入ります。配列にはしません。

```json
{
  "target": "大学の新入生",
  "problem": "授業選びの迷い",
  "cause": "前提知識の不明確さ",
  "purpose": "自分に合った授業の選択",
  "mechanism": "情報の照合による候補提示",
  "context": null
}
```

`values`はアプリへの接続用の内部ノード一覧で、各案・因数ごとに最大1件です。nullの因数は含みません。`comparisons`はしきい値未満も含む比較結果、`pairs`はしきい値以上の関連、`labels`は平均ベクトルを使ったラベルです。以前のvalues配列を返すLLM形式からは互換性のない変更です。古い因数設定・出力は作り直してください。観点変更は`config/default.json`を編集します。

## 因数分解の意味

ここでの因数は、アイデアを構成する機能・部品ではなく、複数のアイデアの本質を共通の観点で捉えるための要素です。観点を「ターゲット・課題・原因・目的・解決原理・利用場面」に更新しました。各因数の値は短い文字列1つ、情報不足ならnullです。提供価値・実現可能性は既定の因数から外しました。これらは確定した分類ではなく、設定で変更できます。

例えば「専門用語の多い講義を、初学者に合わせて言い換える」なら、対象＝「専門分野の初学者」、課題＝「講義の理解困難」、原因＝「前提知識の差」（推測）、目的＝「内容理解の支援」と整理します。「音声認識」「変換ボタン」などの実装一覧にする意図ではありません。

観点IDが`cause`の値同士、`target`の値同士というように比較します。各因数につき値は1つだけです。語句は短くしますが、意味を失ってまで一単語へ圧縮しません。不明な因数はnullになり、ベクトル化・比較を行いません。推測した値には推測区分を保持します。

## 実装した処理

1. `analyze(ideas, config, provider)` が自由文を受け取ります。1件でも開発検証でき、既定上限は5件です。Webアプリ側では企画どおり2〜5件に制限してください。
2. 設定ファイルの観点をGeminiへ渡し、`factors`オブジェクト（各因数ID→文字列またはnull）と根拠などの`details`を生成します。因数は短い名詞句を`label`、詳しい意味を`description`に分離します。原文引用`evidence`と推測区分`inferred`を保持し、JSONを実行時に検証します。入力にない引用、未知の観点、重複値を拒否します。
3. GoogleのEmbedding APIで各値をベクトル化します。現在の既定はユーザーの希望に合わせて短い`label`だけです。曖昧語で精度が下がる場合は設定の`embeddingMode`を`context`へ変更すると説明・原文根拠も含めます。設定変更後は全ベクトルを再生成します。
4. **別アイデアかつ同じ観点**の値だけ比較します。仮の評価式はコサイン類似度、しきい値は0.82です。これは検証済みの最適値ではありません。類似度は確率ではありません。
5. 近いペアの各ベクトルを単位長に正規化してから算術平均を計算します。これによりベクトルの大きさの違いが片方を過度に重みづけしません。
6. Geminiが共通する意味の短いラベル候補を提案します。元の2語も候補に加え、すべて同じEmbeddingモデルでベクトル化し、平均ベクトルへの近さと元の両方の語への近さを評価し、片方に偏らない候補を選びます。
7. 元の値は`values`に保持し、`labels`には選ばれたラベル、元のID、平均ベクトル、候補ごとのスコアを別途格納します。`pairs`はしきい値以上の関係を保持します。

## 平均ベクトルからの単語探索の意味

Embedding APIには、任意のベクトルから対応する単語を逆生成するAPIはありません。本実装は**有限の候補集合の中で平均に最も近いラベルを検索**します。全単語に対する最適解や、厳密に中間にある語を保証しません。候補生成はLLM、最終順位はベクトル計算が担当します。候補の両側への最低類似度を優先し、同点なら平均への近さを使います。

候補が平均から遠い場合は元の語を使い、`fallback-original`と記録します。ラベルは「暫定共通ラベル」として画面に表示する想定です。推測・過度な一般化は実データで検証が必要です。

現在はペアごとにラベルを作り、複数語のクラスタリングは行いません。A≈B、B≈CでもA≈Cとは限らないためです。同じ語が複数ラベルのメンバーになる場合があります。API費用を抑えるため、上位20ペアまでラベルを付けます。それを超えるペアも`pairs`に残ります。

## APIなしで実行

このフォルダを作業ディレクトリにして実行します。

```powershell
npm test
npm run demo
```

`output/analysis.json`が生成されます。モックは「個別最適化」「パーソナライズ」→「個人適応」という固定例です。**一般的な日本語解析や意味ベクトルの品質を検証するものではありません。** 出力の`provider.mode`にもモックであることを明記しています。

## 起床後に必要な作業

1. `.env.example`を`.env`へコピーする。
2. Vertex経由ではVERTEX_SETUP.mdに従って自分のGoogleアカウントでADC認証を設定する。Developer API経由の場合のみAPIキーを設定する。
3. Vertexの場合はプロジェクトID・ロケーションを設定し、利用可能な生成モデルとEmbeddingモデルの名前をそれぞれ設定する。モデル名は固定していません。両モデルがこのREST APIで使えるか確認してください。
4. `npm run analyze`を実行する。実際のモデルの対応状況・日本語精度・遅延・料金はこの段階で検証する。

```powershell
Copy-Item .env.example .env
# .envを編集した後
npm run analyze
```

ライブ接続はGemini Developer APIとVertex AI（現在のGemini Enterprise Agent Platform）に対応しています。現在の既定はVertex経由です。設定手順はVERTEX_SETUP.mdを参照してください。大会CreditはAI Studioには適用されない旨が要綱にあるため、Creditの対象は実際の請求先と配布条件を確認してください。APIキーを共有チャット・Git・`NEXT_PUBLIC_*`へ置かないでください。

## 変更する場所

|変更したい内容|場所|
|---|---|
|観点の追加・削除・説明|`config/default.json`の`factors`|
|近いとするしきい値|`similarityThreshold`|
|ラベル候補数・処理数|`maxCandidates`、`maxLabels`|
|短い語だけ／文脈込み|`embeddingMode`|
|比較の数式|`analyze`または`analyzeValues`の第4引数に関数を渡す|
|平均の計算方法|`src/math.ts`の`meanVector`|
|LLMへの指示とGoogle API|`src/google.ts`|

観点IDは保存データとの対応に使います。意味を変えたときは設定の`version`も更新し、旧結果と混在させないでください。カスタム評価式は[-1,1]の有限値を返す契約です。ラベル順位は引き続きコサイン類似度で評価します。

設定ファイルと出力先はCLI引数で差し替え可能です。

```powershell
node src/cli.ts --mock examples/ideas.json --config=config/default.json --out=output/custom.json
```

## 相手のアプリとの接続

```typescript
// Next.jsのサーバー側のみ
import { analyze, analyzeValues, GoogleProvider } from './algorithm/src/index.ts';
import config from './algorithm/config/default.json';
import type { Config } from './algorithm/src/index.ts';

const provider = new GoogleProvider({
  apiKey: process.env.GEMINI_API_KEY!,
  generationModel: process.env.GEMINI_GENERATION_MODEL!,
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL!,
});
const result = await analyze([
  { id: 'idea-a', text: '入力された案' },
  { id: 'idea-b', text: '別の案' },
], config as Config, provider);

// 保存したIDを維持したまま、編集済みvaluesで関連性だけ更新する。
const updated = await analyzeValues(
  editedValues, config as Config, provider, undefined,
  [['削除したリンクの始点ID', '終点ID']],
);
```

`result.values`を具体的因数ノード、`config.factors`を観点ノード、入力ideasをルートとしてReact Flowの階層を作れます。`pairs.source/target`が案を横断する関連線です。`labels.memberIds`で暫定ラベルを対応づけます。値IDは元案ID・観点・初回抽出ラベルから決定し、再分析は渡されたIDを変えません。手動追加ノードのIDはアプリ側でUUID等を割り当ててください。

認証・所有権確認、Firestoreへの保存、自動保存、版番号の競合対策、レート制限、ボタンの連打対策、画面のエラー表示はアプリ基盤側の責任です。クライアントから任意のGoogleモデル名やAPIキーを受け取らないでください。設定の入力件数・文字数・因数数制限は基盤でも合わせてください。

## 現在の限界と未接続部分

- Google CloudのADC認証で因数抽出・Embedding・平均ベクトルによるラベル選択の実API接続を確認済み。精度評価とCredit適用の確認は別途必要です。詳細はVERTEX_SETUP.mdを参照してください。
- 最新の依頼に合わせ、関連性は同じ観点のベクトル比較で決定しています。企画書の「Geminiによる各関連候補の文脈確認・理由生成」は現段階では未実装です。ラベル候補の生成は行いますが、関連の正当性確認とは別です。
- LLMの構造化出力・推測区分は完全ではありません。生成失敗や不正なJSONは例外にし、不確かな部分を黙って補正しません。
- APIは順次実行し、1リクエストのタイムアウトは60秒です。全体の所要時間が長くなる可能性があるため、本番では実測に基づきジョブ化や限定並列を検討してください。自動再試行は費用の重複を避けるため未実装です。
- Embeddingの重複呼び出しは1回の分析内でキャッシュします。永続キャッシュやDBは導入していません。
- コアの戻り値にはデバッグ用ベクトルが含まれます。画面やFirestoreに全ベクトルを送る必要はありません。基盤側で必要なフィールドだけ保存してください。

## テストと参考

数式、しきい値変更、観点の分離、元値の保持、候補順位、再分析のID保持、削除リンク、入力不正、Embedding不正、HTTPエラーとキー非露出をテストしています。

- [Google Embeddings公式資料](https://ai.google.dev/gemini-api/docs/embeddings)
- [Google構造化出力公式資料](https://ai.google.dev/gemini-api/docs/structured-output)
- [Google GenAI公式実装](https://github.com/googleapis/js-genai)

構造化出力とEmbeddingのリクエスト形は公式情報を参照しています。APIのモデル対応はライブ接続時に確認してください。


