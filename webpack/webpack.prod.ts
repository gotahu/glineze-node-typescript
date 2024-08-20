import { merge } from 'webpack-merge';
import type { Configuration } from 'webpack';
import common from './webpack.common';

const prodConfig: Configuration = {
  mode: 'production',
  // 以下にproduction環境特有の設定を追加
  optimization: {
    minimize: true,
    // 他の最適化オプション...
  },
  performance: {
    hints: 'warning',
    // 他のパフォーマンス関連設定...
  },
  // その他のproduction用設定...
};

export default merge(common, prodConfig);
