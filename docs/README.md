# 📚 SAP売上分析システム - ドキュメント

このフォルダには、プロジェクトのすべてのドキュメントが整理されています。

## 📖 **主要ドキュメント**

### **🎯 プロジェクト概要**
- **[project.md](./project.md)** - プロジェクト全体の詳細概要
- **[プロジェクト概要.md](./プロジェクト概要.md)** - 日本語版概要

### **🔧 開発関連**
- **[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)** - 開発ログ・変更履歴
- **[deploy-lambda.md](./deploy-lambda.md)** - Lambda関数デプロイ手順
- **[TESTING.md](./TESTING.md)** - テスト仕様・手順

### **🗂️ 機能説明**
- **[LEARNING_DATA_GUIDE.md](./LEARNING_DATA_GUIDE.md)** - Human-in-the-Loop学習機能ガイド
- **[supabase-simple-fix.md](./supabase-simple-fix.md)** - Supabase設定・修正ガイド

## 🔄 **再開時の確認項目**

### **✅ 常時稼働中（操作不要）**
- **AWS Amplify**: 自動デプロイ・ホスティング稼働中
- **Supabase**: データベース・学習機能稼働中
- **AWS Lambda + Bedrock**: AI分析エンジン稼働中

### **🚀 再開時の手順**
```bash
# 1. プロジェクトフォルダを開く
cd C:\Users\tsail\Desktop\sap-project-frontend
cursor .  # またはcode .

# 2. 開発サーバー起動
npm run dev

# 3. 本番環境確認
# https://main.de6bhtyldyowa.amplifyapp.com
```

**重要**: AWS Amplify・Supabaseは常時稼働しているため、再開時に特別な起動操作は不要です。

---

## 📞 **サポート**

### **認証情報**
`C:\Users\tsail\Documents\00_プロジェクト管理\01_SAP売上分析システム\認証情報\すべての認証情報.txt`

### **困ったときは**
1. このフォルダ内のドキュメントを確認
2. プロジェクト管理フォルダの認証情報を確認  
3. Claude AIに相談

---

**最終更新**: 2025年9月2日