const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * 拾页本地 Python 引擎运行在 http://127.0.0.1:8080。
 * Android targetSdk 28+ 默认拦截明文 HTTP，这里只用于允许 App 访问本机抓取服务。
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults?.manifest?.application?.[0];
    if (application) {
      application.$ = application.$ || {};
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
