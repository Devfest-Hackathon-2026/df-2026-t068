# Google Cloud 接続設定

Vertex AIはGemini Enterprise Agent Platformへ統合されています。Google公式SDKの`vertexai: true`と、`aiplatform.googleapis.com`、`roles/aiplatform.user`は引き続き利用する識別子です。Agentを作成する必要はありません。

## 今回のプロジェクト

- プロジェクトID：`idea-wave-513901`
- ロケーション候補：`global`。使用モデルが対応することを実接続前に確認する。
- APIキー方式ではなくApplication Default Credentials（ADC）を使用する。
- 認証とAPI有効化を確認し、このプロジェクトで以下のモデルの実呼び出しに成功しました。Creditの適用だけは請求画面で別途確認が必要です。
- 生成モデル：`gemini-3.5-flash-lite`
- Embeddingモデル：`gemini-embedding-2`（3072次元）

## 相手に確認すること

1. このプロジェクトがCreditのある請求先へ紐づいていること。
2. API `aiplatform.googleapis.com`が有効であること。
3. あなたのGoogleアカウントに`roles/aiplatform.user`と`roles/serviceusage.serviceUsageConsumer`が付いていること。

## あなたのPCで行うこと

Google Cloud CLIが未導入のため、先に導入する。導入後、自分のGoogleアカウントで次を実行する。

```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project idea-wave-513901
```

`algorithm/.env`へ以下を記入する。モデル名は利用可能なものを確認してから設定する。

```dotenv
GOOGLE_AI_BACKEND=vertex
GOOGLE_CLOUD_PROJECT=idea-wave-513901
GOOGLE_CLOUD_LOCATION=global
GEMINI_GENERATION_MODEL=gemini-3.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
```

```powershell
npm ci
npm run analyze
```

Cloudの呼び出しには料金が発生する。Creditが適用されるか少量実行後に請求画面で確認する。認証ファイルをGitや共有フォルダへコピーしない。

## 公開時

App Hostingの実行用サービスアカウントにモデル呼び出しの権限を付け、実行環境のADCを使う。ローカルのログイン情報をデプロイしない。ブラウザ側のGoogleログインとは別の認証である。

## 実接続の検証結果

2案の因数抽出とEmbedding生成に成功しました。別途「個別最適化」「パーソナライズ」を比較したところ、類似度は約0.765でした。ラベル段階の接続確認に限ってしきい値を0.5に下げ、平均ベクトルと候補語の比較、元語の保持を確認しました。既定値0.82は変更していません。しきい値はモデル依存なので、今後は正例・負例を使って調整します。

料金例として以前挙げたGemini 2.5 Flashは公式ライフサイクル上で提供終了のため採用しません。実際の費用は上記モデルの料金と使用トークンで再計算します。

## 参照

- https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest
- https://googleapis.github.io/js-genai/release_docs/classes/client.GoogleGenAI.html
