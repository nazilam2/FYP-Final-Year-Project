module.exports = {
  presets: ['module:@react-native/babel-preset'], // Updated preset
  plugins: [
    [
      '@babel/plugin-transform-class-properties',
      {
        loose: true, // Enable loose mode for class properties
      },
    ],
    [
      '@babel/plugin-transform-private-methods',
      {
        loose: true, // Enable loose mode for private methods
      },
    ],
    [
      '@babel/plugin-transform-private-property-in-object',
      {
        loose: true, // Enable loose mode for private properties
      },
    ],
    'react-native-reanimated/plugin', // Existing plugin
  ],
};