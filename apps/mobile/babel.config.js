// Plan 4, Task 3: `react-native-reanimated` 4.x needs its worklets Babel transform wired in — the
// plugin now ships from the split-out `react-native-worklets` package (not `react-native-reanimated`
// itself), and per its docs must be listed LAST.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
