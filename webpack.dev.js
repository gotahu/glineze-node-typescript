/* eslint-disable @typescript-eslint/no-var-requires */
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

const path = require('path');
const outputPath = path.resolve(__dirname, 'bundle');

module.exports = merge(common, {
  mode: 'development', // 開発モード
  devtool: 'inline-source-map', // ソースマップを出力
  watch: true, // ファイルの変更を監視
  watchOptions: {
    ignored: /node_modules/, // node_modules ディレクトリは監視対象外
  },
  devServer: {
    contentBase: outputPath, // 開発サーバのルートディレクトリ
    open: true, // ブラウザを自動で開く
  },
});
