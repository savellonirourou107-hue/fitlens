const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 在 web 平台上把 react-native-svg 映射到 react-native-svg-web
const resolverAlias = config.resolver.alias || {};
resolverAlias['react-native-svg'] = 'react-native-svg-web';
config.resolver.alias = resolverAlias;

const webModuleMap = new Map([
  [path.join(__dirname, 'src', 'core', 'db'), path.join(__dirname, 'src', 'core', 'db.web.ts')],
  [
    path.join(__dirname, 'src', 'core', 'repository'),
    path.join(__dirname, 'src', 'core', 'repository.web.ts'),
  ],
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.startsWith('.')) {
    const origin = context.originModulePath ?? __dirname;
    const requested = path.normalize(path.resolve(path.dirname(origin), moduleName));
    const mapped = webModuleMap.get(requested);
    if (mapped) {
      return { type: 'sourceFile', filePath: mapped };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
