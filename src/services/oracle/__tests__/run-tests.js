#!/usr/bin/env node

/**
 * Oracle System Test Runner
 * Comprehensive test execution with reporting
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testDir = __dirname;
const rootDir = path.join(testDir, '..');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  const border = '='.repeat(60);
  log(border, 'cyan');
  log(message.padStart((message.length + 60) / 2), 'cyan');
  log(border, 'cyan');
}

function runCommand(command, description) {
  log(`\n${description}...`, 'yellow');
  try {
    const output = execSync(command, { 
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    log(`✅ ${description} completed`, 'green');
    return { success: true, output };
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    log(error.stdout || error.message, 'red');
    return { success: false, error };
  }
}

async function main() {
  header('Oracle System Test Suite');
  
  const startTime = Date.now();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Check if Jest is available
  log('\n🔍 Checking test environment...', 'blue');
  
  try {
    execSync('npx jest --version', { cwd: rootDir, stdio: 'pipe' });
    log('✅ Jest is available', 'green');
  } catch (error) {
    log('❌ Jest is not available. Please install Jest:', 'red');
    log('npm install --save-dev jest @types/jest ts-jest', 'yellow');
    process.exit(1);
  }

  // Test categories
  const testCategories = [
    {
      name: 'Unit Tests - Oracle Providers',
      pattern: '__tests__/adapters/*.test.ts',
      description: 'Testing individual oracle provider adapters'
    },
    {
      name: 'Unit Tests - Consensus Service', 
      pattern: '__tests__/OracleConsensusService.test.ts',
      description: 'Testing consensus algorithms and aggregation'
    },
    {
      name: 'Unit Tests - API Controller',
      pattern: '__tests__/api/*.test.ts', 
      description: 'Testing REST API endpoints and controllers'
    },
    {
      name: 'Integration Tests',
      pattern: '__tests__/integration/*.test.ts',
      description: 'Testing complete system workflows'
    }
  ];

  let allTestsPassed = true;

  for (const category of testCategories) {
    header(category.name);
    log(category.description, 'blue');

    const jestCommand = `npx jest --config=${path.join(testDir, 'jest.config.js')} --testPathPatterns="${category.pattern}" --verbose`;
    
    const result = runCommand(jestCommand, `Running ${category.name}`);
    
    if (result.success) {
      // Parse Jest output for test statistics
      const output = result.output;
      const testMatch = output.match(/Tests:\s+(\d+)\s+passed/);
      if (testMatch) {
        const categoryPassed = parseInt(testMatch[1]);
        passedTests += categoryPassed;
        totalTests += categoryPassed;
        log(`📊 ${category.name}: ${categoryPassed} tests passed`, 'green');
      }
    } else {
      allTestsPassed = false;
      failedTests += 1;
      
      // Try to extract failure information
      const errorOutput = result.error.stdout || result.error.message;
      if (errorOutput.includes('FAIL')) {
        const failMatch = errorOutput.match(/(\d+)\s+failing/);
        if (failMatch) {
          failedTests += parseInt(failMatch[1]) - 1; // Already counted 1 above
        }
      }
    }
  }

  // Run coverage report
  if (allTestsPassed) {
    header('Coverage Report');
    
    const coverageCommand = `npx jest --config=${path.join(testDir, 'jest.config.js')} --coverage --coverageDirectory=${path.join(rootDir, 'coverage')}`;
    
    const coverageResult = runCommand(coverageCommand, 'Generating coverage report');
    
    if (coverageResult.success) {
      log('📊 Coverage report generated in ./coverage directory', 'green');
      
      // Try to extract coverage summary
      const coverageOutput = coverageResult.output;
      const coverageMatch = coverageOutput.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
      
      if (coverageMatch) {
        const [, statements, branches, functions, lines] = coverageMatch;
        log(`📈 Coverage Summary:`, 'cyan');
        log(`   Statements: ${statements}%`, 'white');
        log(`   Branches: ${branches}%`, 'white');
        log(`   Functions: ${functions}%`, 'white');
        log(`   Lines: ${lines}%`, 'white');
      }
    }
  }

  // Performance benchmarks (if all tests pass)
  if (allTestsPassed) {
    header('Performance Benchmarks');
    
    const benchmarkCommand = `npx jest --config=${path.join(testDir, 'jest.config.js')} --testNamePatterns="Performance|performance" --verbose`;
    
    runCommand(benchmarkCommand, 'Running performance benchmarks');
  }

  // Final summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  header('Test Summary');
  
  if (allTestsPassed) {
    log(`🎉 All tests completed successfully!`, 'green');
    log(`📊 Total: ${totalTests} tests passed`, 'green');
    log(`⏱️  Duration: ${duration} seconds`, 'blue');
    
    // Check for test artifacts
    const coverageDir = path.join(rootDir, 'coverage');
    const testResultsDir = path.join(rootDir, 'test-results');
    
    if (fs.existsSync(coverageDir)) {
      log(`📁 Coverage report: ./coverage/lcov-report/index.html`, 'cyan');
    }
    
    if (fs.existsSync(testResultsDir)) {
      log(`📁 Test results: ./test-results/junit.xml`, 'cyan');
    }
    
    process.exit(0);
    
  } else {
    log(`❌ Some tests failed`, 'red');
    log(`📊 Passed: ${passedTests}, Failed: ${failedTests}`, 'yellow');
    log(`⏱️  Duration: ${duration} seconds`, 'blue');
    
    log(`\n🔧 Troubleshooting tips:`, 'yellow');
    log(`   • Check test logs above for specific failures`, 'white');
    log(`   • Run individual test categories for debugging`, 'white');
    log(`   • Verify all dependencies are installed`, 'white');
    log(`   • Check TypeScript compilation errors`, 'white');
    
    process.exit(1);
  }
}

// Command line argument parsing
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Oracle System Test Runner

Usage:
  node run-tests.js [options]

Options:
  --help, -h     Show this help message
  --watch        Run tests in watch mode
  --coverage     Run with coverage reporting
  --unit         Run only unit tests
  --integration  Run only integration tests

Examples:
  node run-tests.js                    # Run all tests
  node run-tests.js --unit            # Run only unit tests
  node run-tests.js --coverage        # Run with coverage
  `);
  process.exit(0);
}

// Run with specific options
if (args.includes('--unit')) {
  log('Running unit tests only...', 'blue');
  const command = `npx jest --config=${path.join(testDir, 'jest.config.js')} --testPathPatterns="adapters|OracleConsensusService|api" --verbose`;
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
  process.exit(0);
}

if (args.includes('--integration')) {
  log('Running integration tests only...', 'blue');
  const command = `npx jest --config=${path.join(testDir, 'jest.config.js')} --testPathPatterns="integration" --verbose`;
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
  process.exit(0);
}

if (args.includes('--watch')) {
  log('Running tests in watch mode...', 'blue');
  const command = `npx jest --config=${path.join(testDir, 'jest.config.js')} --watch`;
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
  process.exit(0);
}

// Run main test suite
main().catch(error => {
  log(`\n💥 Test runner crashed: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});