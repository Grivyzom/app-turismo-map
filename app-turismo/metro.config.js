const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Ensure Metro watches the project root and node_modules correctly
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Experimental: support for symlinks if using pnpm
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
// Exclude build artifacts, cache folders, and heavy non-code files from Metro's file watcher and bundler
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const projectDirPattern = (dir) =>
  new RegExp(`^${escapeRegExp(projectRoot)}[\\\\/]${dir}[\\\\/].*`);

config.resolver.blockList = [
  ...defaultBlockList,
  // Build and export directories
  // Solo los del proyecto: los paquetes de node_modules publican su código en build/ y dist/.
  projectDirPattern('dist'),
  projectDirPattern('web-build'),
  projectDirPattern('build'),
  // Expo cache & temporary directories (prevent indexing 10MB+ dev caches)
  /.*[\\/]\.expo[\\/].*/,
  // Cache and temporary files
  /.*[\\/]\.cache[\\/].*/,
  /.*[\\/]node_modules[\\/]\.ignored[\\/].*/,
  /.*[\\/]node_modules[\\/]\.cache[\\/].*/,
  /.*_tmp_.*/,
  // Version control and tooling metadata
  /.*[\\/]\.git[\\/].*/,
  /.*[\\/]\.claude[\\/].*/,
  /.*[\\/]\.antigravitycli[\\/].*/,
  /.*[\\/]\.gemini[\\/].*/,
  // Unused heavy GeoJSON or static standalone files not part of app code
  /.*\.geojson$/,
  /.*[\\/]MiniModal Standalone\.html$/,
];

module.exports = withNativeWind(config, {
  input: './global.css',
});
