import { merge } from 'webpack-merge';
import type { Configuration } from 'webpack';
import common from './webpack.common';

const devConfig: Configuration = {
  mode: 'development',
  devtool: 'inline-source-map',
};

export default merge(common, devConfig);
