# 📋 マスタープロジェクトガイド - SAP Frontend

**統合管理ドキュメント - これを見れば全てがわかる**  
最終更新: 2025年9月3日  

---

## 🎯 **このドキュメントの目的**

全てのプロジェクト情報・手順・管理方法を**1つの場所**に集約し、何を見ればいいかすぐにわかるようにする。

---

## 📚 **ドキュメント構成マップ**

```
📁 SAP Frontend プロジェクト
├── 🎯 MASTER_PROJECT_GUIDE.md     ← 👈 このファイル（入口）
├── 📋 docs/PROJECT_MANAGEMENT.md   ← 技術詳細・運用手順
├── 🏗️ cdk/README.md               ← CDK インフラ詳細
├── 📖 README.md                    ← プロジェクト基本情報
└── 🔧 SETUP-GITHUB.md             ← GitHub 連携手順
```

---

## 🗂️ **プロジェクト管理フォルダとの連携**

### **物理的な管理場所**
```
📁 C:\Users\tsail\Documents\00_プロジェクト管理\01_SAP売上分析システム\
├── 📁 認証情報\
│   ├── 🔐 すべての認証情報.txt
│   ├── 🔑 AWS認証情報.txt
│   ├── 🐙 GitHub認証情報.txt
│   ├── 🚨 Sentry認証情報.txt
│   └── 📱 LINE認証情報.txt
├── 📁 マニュアル\
│   ├── 📋 このファイル.md           ← MASTER_PROJECT_GUIDE.md をコピー
│   ├── ⚙️ CDKデプロイ手順.md
│   ├── 🚀 開発環境セットアップ.md
│   └── 🔧 運用マニュアル.md
└── 📁 開発環境\
    ├── 🔧 環境変数設定例.txt
    ├── 📊 AWSアカウント情報.txt
    └── 📝 作業履歴.txt
```

---

## ⚡ **クイックアクセスガイド**

### **🎯 目的別アクセス**

| やりたいこと | 参照先 |
|-------------|---------|
| **🚀 プロジェクト開始** | `docs/PROJECT_MANAGEMENT.md` → デプロイメント手順 |
| **🔐 ログイン情報確認** | `認証情報\すべての認証情報.txt` |
| **🏗️ インフラ構築** | `cdk/README.md` + `cdk/scripts/deploy.sh` |
| **🐛 エラー対応** | `docs/PROJECT_MANAGEMENT.md` → トラブル対応 |
| **📊 新プロジェクト作成** | このファイル → 新プロジェクト流用方法 |
| **🔄 日常メンテナンス** | `docs/PROJECT_MANAGEMENT.md` → 日常運用 |

---

## 🏗️ **CDK・Amplify・インフラ管理方針**

### **✅ 採用方針: プロジェクトごとCDK管理**

**理由:**
- ✅ **独立性**: プロジェクト間の影響なし
- ✅ **効率性**: アプリとインフラの同時開発
- ✅ **拡張性**: 新プロジェクトでのテンプレート活用

### **🔄 管理フロー**

```mermaid
graph TD
    A[新プロジェクト開始] --> B[プロジェクト管理フォルダ作成]
    B --> C[CDKテンプレートコピー]
    C --> D[プロジェクト固有設定変更]
    D --> E[認証情報設定]
    E --> F[CDKデプロイ]
    F --> G[運用開始]
```

### **📋 各プロジェクトでのCDK構成**
```
各プロジェクト/
├── src/                 ← React アプリ
├── cdk/                 ← AWS CDK (このプロジェクト専用)
│   ├── lib/            ← インフラコード
│   ├── scripts/        ← デプロイスクリプト
│   └── .env            ← CDK環境変数
├── docs/               ← 技術ドキュメント
└── README.md           ← プロジェクト説明
```

---

## 🆕 **新プロジェクト作成時の完全ガイド**

### **Step 1: プロジェクト管理フォルダ準備**
```bash
# 新しいプロジェクトフォルダ作成
mkdir "C:\Users\tsail\Documents\00_プロジェクト管理\03_新プロジェクト名"
cd "C:\Users\tsail\Documents\00_プロジェクト管理\03_新プロジェクト名"

# 標準構造作成
mkdir 認証情報 マニュアル 開発環境
```

### **Step 2: 開発プロジェクト作成**
```bash
# 開発ディレクトリ作成
cd "C:\Users\tsail\Desktop"
mkdir new-project-name
cd new-project-name

# Git 初期化
git init
git remote add origin https://github.com/username/new-project.git
```

### **Step 3: CDKテンプレート流用**
```bash
# SAP Frontend プロジェクトから CDK をコピー
cp -r ../sap-project-frontend/cdk ./cdk
cp -r ../sap-project-frontend/src ./src  # 必要に応じて
cp ../sap-project-frontend/package.json ./package.json

# プロジェクト固有設定変更
# 1. package.json の name 変更
# 2. cdk/bin/cdk.ts のスタック名変更
# 3. cdk/lib/cdk-stack.ts のリソース名変更
```

### **Step 4: ドキュメント流用**
```bash
# ドキュメントをコピー
cp ../sap-project-frontend/MASTER_PROJECT_GUIDE.md ./
cp -r ../sap-project-frontend/docs ./docs

# プロジェクト管理フォルダにもコピー
cp MASTER_PROJECT_GUIDE.md "C:\Users\tsail\Documents\00_プロジェクト管理\03_新プロジェクト名\マニュアル\"
```

---

## 🔐 **認証情報管理テンプレート**

### **新プロジェクト用認証情報ファイル**

```
=== 新プロジェクト - すべての認証情報 ===

【AWS】
- Account ID: 123456789012
- Region: ap-northeast-1  
- IAM User: [CDK用ユーザー名]
- Access Key ID: AKIAXXXXXXXXXXXXXXXX
- Secret Access Key: [シークレット]

【GitHub】
- Repository: username/new-project-name
- Personal Access Token: ghp_xxxxxxxxxxxxxxxx

【Sentry】（必要に応じて新規作成）
- Project Name: new-project-name
- DSN: https://xxxxxxxxx@sentry.io/xxxxxxx

【LINE Notify】（共通 or 新規）
- Token: [LINEトークン]

【その他】
- Domain: [独自ドメイン使用時]
- SSL Certificate: [証明書情報]
```

---

## 📊 **プロジェクト一覧管理**

### **現在管理中のプロジェクト**

| No. | プロジェクト名 | 状態 | CDK | 最終更新 |
|-----|---------------|------|-----|----------|
| 01  | SAP売上分析システム | ✅ 運用中 | ✅ 完成 | 2025/09/03 |
| 02  | RepoTomo_new | 🔄 開発中 | ⏳ 準備中 | - |
| 03  | [次期プロジェクト] | 📋 計画中 | - | - |

---

## 🎯 **このシステムの使い方**

### **日常的に参照するファイル**
1. **このファイル** (MASTER_PROJECT_GUIDE.md) - 全体把握・何を見るべきか判断
2. **認証情報\すべての認証情報.txt** - ログイン・API情報
3. **docs/PROJECT_MANAGEMENT.md** - 技術詳細・手順

### **困った時の対処法**
1. **まずこのファイルを開く** → 目的別アクセス表で確認
2. **認証情報を確認** → プロジェクト管理フォルダ
3. **技術的問題** → docs/PROJECT_MANAGEMENT.md のトラブル対応
4. **それでも解決しない** → Claude Code に相談

### **新メンバーへの引き継ぎ**
1. このファイルを最初に見せる
2. プロジェクト管理フォルダの場所を案内
3. 認証情報アクセス権限を付与
4. 開発環境セットアップ手順を実行

---

## 🚨 **重要な注意事項**

### **セキュリティ**
- 🔐 認証情報ファイルをGitにコミットしない
- 📂 プロジェクト管理フォルダを定期バックアップ
- 🔄 認証情報の有効期限を定期確認

### **メンテナンス**
- 📝 このファイルを月次で更新
- 🔄 プロジェクト一覧を随時更新
- 📊 不要プロジェクトのアーカイブ化

---

## 📞 **困った時の連絡先**

### **内部リソース**
- **プロジェクト管理フォルダ**: `C:\Users\tsail\Documents\00_プロジェクト管理\`
- **開発コード**: `C:\Users\tsail\Desktop\sap-project-frontend\`
- **GitHub**: https://github.com/tsailink0611/sap-project-frontend

### **外部サービス**
- **Sentry**: https://sentry.io/tsailink-dev/
- **AWS Console**: https://console.aws.amazon.com/
- **LINE Notify**: https://notify-bot.line.me/ja/

---

**💡 このドキュメントをプロジェクト管理フォルダの `マニュアル\` にコピーして、いつでもアクセスできるようにしてください。**