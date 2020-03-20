module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    "src"
  ],
  collectCoverage: true,
  coverageReporters: ['html', 'json', 'lcov', 'text', 'clover'],
  coverageDirectory: 'reports/coverage',
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}"
  ],
};