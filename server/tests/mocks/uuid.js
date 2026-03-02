// Mock uuid module for testing
let counter = 0;

module.exports = {
  v4: () => `test-uuid-${counter++}`,
  MAX: 'maximum-uuid'
};
