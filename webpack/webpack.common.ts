import path from 'path';
import nodeExternals from 'webpack-node-externals';
import type { Configuration } from 'webpack';

const config: Configuration = {
  target: 'node', // Node.js 環境用に設定
  entry: './src/app.ts', // エントリポイント
  output: {
    filename: 'app.js', // 出力ファイル名
    path: path.resolve(__dirname, 'bundle'), // 出力ディレクトリ
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // 解決可能な拡張子
  },
  externals: [nodeExternals()], // Node.js の組み込みモジュールをバンドルから除外
};

export default config;
