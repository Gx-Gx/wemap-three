
const { resolve } = require('path');

const dev = process.env.NODE_ENV === 'development';

const config = {
  mode: dev ? 'development' : 'production',

  // 配置页面入口 js 文件
  entry: './src/index.js',

  // 配置打包输出相关
  output: {
    // 打包输出目录
    path: resolve(process.cwd(), 'dist'),
  },

  devServer: {
    host: '0.0.0.0',
    port: 8081,
    publicPath: '/',
    hot: true,
    disableHostCheck: true,
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },

      {
        test: /\.html$/,
        loader: 'art-template-loader'
      },

      {
        // 匹配 css 文件
        test: /\.(scss|css)$/,
        use: dev ? ['style-loader?sourceMap', 'css-loader?sourceMap', 'sass-loader?sourceMap'] : ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|eot|ttf|woff|woff2|svg|svgz)(\?.+)?$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 10000
            }
          }
        ]
      }
    ]
  },

};

if (dev) {
  config.devtool = 'cheap-module-eval-source-map';
} else {
  config.devtool = 'source-map';
}

module.exports = config;
