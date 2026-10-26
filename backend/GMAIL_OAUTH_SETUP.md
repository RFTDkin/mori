# M.O.R.I. Gmail OAuth セットアップ

M.O.R.I. は Gmail のパスワードを保存しません。初回だけ Google の公式ログイン画面で、使用するアカウントを選択します。

1. [Google Cloud Console](https://console.cloud.google.com/) で新しいプロジェクトを作成します。
2. 「APIs とサービス」から **Gmail API** を有効にします。
3. 「Google Auth Platform」で OAuth 同意画面を設定します。卒業研究の段階では Audience を **External** にし、自分の Gmail を **Test users** に追加してください。
4. 「Clients」で **Web application** の OAuth Client を作成し、Authorized redirect URI に次を正確に追加します。

   ```text
   http://localhost:8000/api/gmail/oauth/callback
   ```

5. Client ID と Client secret を `backend/.env` に追加します。Gmail アドレスや Gmail パスワードは書きません。

   ```env
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/gmail/oauth/callback
   FRONTEND_ORIGIN=http://localhost:3000
   ```

6. `start_mori.bat` で M.O.R.I. を再起動し、「Gmailを開いて」と話しかけます。表示された **GOOGLE でログイン** を押し、Google の公式画面でログインと許可を完了します。

認可後に作られる `backend/gmail_token.json` は、この PC で再ログインを省略するための OAuth トークンです。Git には追加されません。アカウントを切り替えたい場合は、M.O.R.I. を停止してこのファイルを削除してから再起動してください。
