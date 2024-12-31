import { merge } from 'webpack-merge';
import type { Configuration } from 'webpack';
import common from './webpack.common';
import path from 'path';

const prodConfig: Configuration = {
  mode: 'production',
  entry: {
    app: './src/app.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../dist'),
  },
  optimization: {
    minimize: true,
  },
};

export default merge(common, prodConfig);
