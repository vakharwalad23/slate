const { getDefaultConfig } = require('expo/metro-config');

// @expo/metro-config auto-detects the pnpm workspace and sets watchFolders.
const config = getDefaultConfig(__dirname);

// Strip console.* from minified (production) bundles only; the dev server does not minify.
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  compress: {
    ...config.transformer.minifierConfig?.compress,
    drop_console: true,
  },
};

module.exports = config;
