module.exports = {
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    testEnvironment: 'jsdom',
    transform: {
      '^.+\\.jsx?$': 'babel-jest', // 👈 transform JS/JSX using Babel
    },
    transformIgnorePatterns: [
      'node_modules/(?!(react-leaflet|@react-leaflet|leaflet)/)', // allow transforming these ESM packages
    ],
    moduleNameMapper: {
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // mock CSS files
    },
  };
  