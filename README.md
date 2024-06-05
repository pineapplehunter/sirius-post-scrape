# SIRIUS scrape

## 準備
これらをインストール
- bun
- chrome

依存関係をダウンロード：
```bash
$ bun install
```

認証情報の作成：
SIRIUSの認証情報を入れる
```bash
$ cp secrets-sample.json secrets.json
```

## 実行
このコマンドを実行してください．
```bash
$ SIRIUS_SCRAPE_HEADLESS=false bun run index.ts
```

`posts.sqlite`が生成されます

ヘッドレス実行を行うためには`SIRIUS_SCRAPE_HEADLESS=true`に環境変数を設定してください．

DISCORDへのデータの送信には`SIRIUS_SCRAPE_SEND_DISCORD=1`を環境変数で指定してください．