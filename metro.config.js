const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 在 web 平台上把 react-native-svg 映射到 react-native-svg-web
const resolverAlias = config.resolver.alias || {};
resolverAlias['react-native-svg'] = 'react-native-svg-web';
config.resolver.alias = resolverAlias;

module.exports = config;
