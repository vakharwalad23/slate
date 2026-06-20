const { getDefaultConfig } = require('expo/metro-config');

// @expo/metro-config auto-detects the pnpm workspace and sets watchFolders.
module.exports = getDefaultConfig(__dirname);
