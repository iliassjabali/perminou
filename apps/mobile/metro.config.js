const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo SDK 52+ auto-detects the pnpm monorepo root and configures
// watchFolders / nodeModulesPaths accordingly, so no manual monorepo
// wiring is needed here beyond the NativeWind wrapper.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
