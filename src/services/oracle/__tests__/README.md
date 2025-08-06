# Oracle System Tests

Comprehensive test suite for the multi-source oracle system with dynamic data aggregation and chatbot integration.

## Test Categories

### 🧪 Unit Tests
- **Oracle Providers** (`adapters/*.test.ts`)
  - CoinGecko adapter functionality
  - Weather data provider
  - Custom API integrations
  - Provider health checks and metrics

- **Consensus Service** (`OracleConsensusService.test.ts`)
  - Median consensus algorithm
  - Weighted average calculations
  - Majority vote for categorical data
  - Confidence-weighted aggregation
  - Outlier detection and removal

- **API Controller** (`api/*.test.ts`)
  - REST endpoint functionality
  - Request validation
  - Error handling
  - Response formatting

### 🔗 Integration Tests
- **End-to-End Workflows** (`integration/*.test.ts`)
  - Complete oracle query processing
  - Provider failure recovery
  - Concurrent query handling
  - Performance under load
  - Caching system validation

## Running Tests

### Prerequisites
```bash
npm install --save-dev jest @types/jest ts-jest
```

### Run All Tests
```bash
node run-tests.js
```

### Run Specific Categories
```bash
# Unit tests only
node run-tests.js --unit

# Integration tests only  
node run-tests.js --integration

# With coverage report
node run-tests.js --coverage

# Watch mode for development
node run-tests.js --watch
```

### Manual Jest Commands
```bash
# All tests with verbose output
npx jest --config=jest.config.js --verbose

# Specific test file
npx jest --config=jest.config.js CoinGeckoOracleAdapter.test.ts

# Coverage report
npx jest --config=jest.config.js --coverage
```

## Test Structure

```
__tests__/
├── adapters/
│   ├── CoinGeckoOracleAdapter.test.ts
│   └── WeatherOracleAdapter.test.ts
├── api/
│   └── OracleAPIController.test.ts
├── integration/
│   └── OracleSystem.integration.test.ts
├── utils/
│   └── testUtils.ts
├── jest.config.js
├── setup.ts
├── run-tests.js
└── README.md
```

## Test Utilities

### Mock Providers
```typescript
import { MockOracleProvider, createMockProviders } from './utils/testUtils';

// Create multiple mock providers
const providers = createMockProviders(3);

// Configure provider responses
providers[0].setResponseData({ price: 42000 });
providers[0].setFailure(true); // Simulate failure
providers[0].setDelay(1000);   // Simulate latency
```

### Test Data Generation
```typescript
import { generateMockPriceData, generateMockWeatherData } from './utils/testUtils';

const btcData = generateMockPriceData('BTC', 42000);
const londonWeather = generateMockWeatherData('London');
```

### Async Testing Helpers
```typescript
import { waitFor, withTimeout, expectApproximately } from './utils/testUtils';

// Wait for async operations
await waitFor(100);

// Test with timeout
const result = await withTimeout(longRunningOperation(), 5000);

// Approximate number comparison
expectApproximately(result.price, 42000, 0.01); // ±1% tolerance
```

## Test Coverage

The test suite aims for:
- **80%+ Line Coverage** - All critical code paths tested
- **80%+ Branch Coverage** - Error conditions and edge cases
- **80%+ Function Coverage** - All public methods tested
- **80%+ Statement Coverage** - Comprehensive execution testing

### Coverage Reports
- **HTML Report**: `./coverage/lcov-report/index.html`
- **LCOV Data**: `./coverage/lcov.info`
- **Text Summary**: Displayed in terminal

## Mock Configuration

### External APIs
```typescript
// Global fetch mock
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ bitcoin: { usd: 42000 } })
});
```

### Discord Bot
```typescript
// Discord client mock
jest.mock('discord.js', () => ({
  Client: jest.fn(() => ({
    login: jest.fn().mockResolvedValue('token'),
    on: jest.fn(),
    channels: { fetch: jest.fn() }
  }))
}));
```

### Hedera SDK
```typescript
// Hedera consensus service mock
jest.mock('@hashgraph/sdk', () => ({
  Client: { forTestnet: jest.fn(() => ({ setOperator: jest.fn() })) },
  TopicMessageSubmitTransaction: jest.fn(() => ({
    setTopicId: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ transactionId: 'mock-id' })
  }))
}));
```

## Performance Testing

### Load Testing
```typescript
it('should handle concurrent queries efficiently', async () => {
  const promises = Array(10).fill(0).map(() => 
    oracleRouter.query('BTC price')
  );
  
  const results = await Promise.all(promises);
  expect(results.every(r => r.confidence > 0.5)).toBe(true);
});
```

### Latency Testing
```typescript
it('should complete queries within acceptable time', async () => {
  const startTime = Date.now();
  await oracleRouter.query('BTC price');
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(2000); // 2 second max
});
```

## Error Scenarios

### Provider Failures
```typescript
// Test graceful degradation
mockProviders[0].setFailure(true);
const result = await oracleRouter.query('BTC price');
expect(result.sources).not.toContain('mock-provider-0');
```

### Network Timeouts
```typescript
// Test timeout handling
mockProviders[0].setDelay(10000);
const result = await oracleRouter.query('BTC price', { timeout: 1000 });
expect(result.sources).toHaveLength(2); // Excluded slow provider
```

### Invalid Data
```typescript
// Test data validation
mockProviders[0].setResponseData(null);
const result = await oracleRouter.query('BTC price');
expect(result.sources).not.toContain('mock-provider-0');
```

## Debugging Tests

### Enable Debug Output
```bash
DEBUG=oracle:* node run-tests.js
```

### Console Logging
```typescript
// Temporarily enable console output
const originalConsole = console.log;
console.log = originalConsole;
console.log('Debug info:', result);
console.log = jest.fn(); // Restore mock
```

### Test Isolation
```typescript
describe.only('CoinGecko Adapter', () => {
  // Only run this test suite
});

it.only('should handle valid requests', async () => {
  // Only run this specific test
});
```

## Continuous Integration

### GitHub Actions
```yaml
- name: Run Oracle Tests
  run: |
    cd src/services/oracle
    node __tests__/run-tests.js --coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./src/services/oracle/coverage/lcov.info
```

### Test Reporting
- **JUnit XML**: `./test-results/junit.xml`
- **Coverage LCOV**: `./coverage/lcov.info`
- **HTML Reports**: `./coverage/lcov-report/`

## Best Practices

1. **Test Isolation** - Each test should be independent
2. **Descriptive Names** - Clear test descriptions
3. **Arrange-Act-Assert** - Structure tests consistently  
4. **Mock External Dependencies** - Don't rely on real APIs
5. **Test Edge Cases** - Error conditions and boundaries
6. **Performance Awareness** - Test with realistic data volumes
7. **Clean Up** - Reset state between tests

## Troubleshooting

### Common Issues

**TypeScript Errors**
```bash
# Check TypeScript compilation
npx tsc --noEmit --project tsconfig.json
```

**Import Path Issues**
```typescript
// Use relative imports in tests
import { OracleRouter } from '../OracleRouter';
```

**Mock Not Working**
```typescript
// Ensure mocks are before imports
jest.mock('module-name');
import { ModuleClass } from 'module-name';
```

**Test Timeouts**
```typescript
// Increase timeout for slow tests
jest.setTimeout(30000);
```

### Debug Commands
```bash
# Run single test file
npx jest CoinGeckoOracleAdapter.test.ts --verbose

# Run with debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Check test configuration
npx jest --showConfig
```