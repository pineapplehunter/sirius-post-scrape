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
bun run index.ts
```

`posts.sqlite`が生成されます