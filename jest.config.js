module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native.*|@react-native(-community)?|firebase|@firebase|uuid)/)',
  ],
  moduleNameMapper: {
    '^@firebase/util/dist/postinstall\\.mjs$': '<rootDir>/jest.firebase-postinstall.js',
  },
};
