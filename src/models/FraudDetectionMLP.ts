/**
 * Issue #7: Fraud Detection Multi-Layer Perceptron Model
 * 
 * A lightweight MLP designed for blockchain transaction fraud detection.
 * Optimized for fixed-point arithmetic and smart contract deployment.
 * 
 * Architecture:
 * - Input Layer: 10 features (transaction characteristics)
 * - Hidden Layer 1: 8 neurons (ReLU activation)
 * - Hidden Layer 2: 4 neurons (ReLU activation) 
 * - Output Layer: 1 neuron (Sigmoid activation - fraud probability)
 */

import { FixedPointMLModel, floatToFixed, fixedToFloat, calculateMetrics, ModelMetrics } from '../utils/fixedPointMath';

/**
 * Transaction features for fraud detection
 */
export interface TransactionFeatures {
  amount: number;           // Transaction amount (normalized)
  gasPrice: number;         // Gas price used (normalized)
  gasLimit: number;         // Gas limit set (normalized)
  timeOfDay: number;        // Hour of day (0-23, normalized to 0-1)
  dayOfWeek: number;        // Day of week (0-6, normalized to 0-1)
  accountAge: number;       // Sender account age in days (normalized)
  transactionCount: number; // Daily transaction count (normalized)
  avgAmount: number;        // Average transaction amount (normalized)
  velocityScore: number;    // Transaction velocity score (0-1)
  networkCongestion: number; // Network congestion level (0-1)
}

/**
 * Training data point
 */
export interface FraudDataPoint {
  features: TransactionFeatures;
  label: number; // 0 = legitimate, 1 = fraudulent
}

/**
 * Fraud Detection MLP Model Class
 */
export class FraudDetectionMLP {
  private model: FixedPointMLModel;
  private readonly inputSize = 10;
  private readonly hiddenSizes = [8, 4];
  private readonly outputSize = 1;
  
  // Pre-trained weights (these would typically come from off-chain training)
  private readonly preTrainedWeights = [
    // Layer 1: 10 inputs -> 8 hidden neurons
    [
      [ 0.423, -0.156,  0.789, -0.234,  0.567, -0.123,  0.345,  0.678, -0.234,  0.456],
      [-0.234,  0.567, -0.123,  0.789, -0.456,  0.234, -0.567,  0.123,  0.456, -0.789],
      [ 0.678, -0.345,  0.234, -0.567,  0.123,  0.789, -0.234,  0.456, -0.123,  0.345],
      [-0.456,  0.234, -0.789,  0.123,  0.567, -0.345,  0.678, -0.234,  0.567, -0.123],
      [ 0.345,  0.789, -0.456,  0.234, -0.123,  0.567, -0.789,  0.345, -0.678,  0.234],
      [-0.567,  0.123,  0.456, -0.789,  0.345, -0.234,  0.123,  0.678, -0.345,  0.567],
      [ 0.234, -0.678,  0.345,  0.567, -0.234,  0.456, -0.123,  0.789, -0.567,  0.123],
      [ 0.789, -0.234,  0.567, -0.123,  0.678, -0.456,  0.234, -0.345,  0.123,  0.567]
    ],
    // Layer 2: 8 hidden -> 4 hidden neurons  
    [
      [ 0.567, -0.234,  0.678, -0.123,  0.456,  0.345, -0.789,  0.234],
      [-0.345,  0.678, -0.456,  0.234, -0.567,  0.123,  0.789, -0.345],
      [ 0.234, -0.567,  0.123,  0.789, -0.234,  0.456, -0.678,  0.345],
      [-0.678,  0.123, -0.345,  0.456,  0.789, -0.567,  0.234, -0.123]
    ],
    // Layer 3: 4 hidden -> 1 output neuron
    [
      [ 0.789, -0.456,  0.234,  0.567]
    ]
  ];
  
  private readonly preTrainedBiases = [
    // Layer 1 biases (8 neurons)
    [0.1, -0.05, 0.15, -0.08, 0.12, -0.03, 0.07, 0.09],
    // Layer 2 biases (4 neurons)
    [0.05, -0.02, 0.08, -0.04],
    // Layer 3 biases (1 neuron)
    [0.01]
  ];
  
  private readonly activations: ('sigmoid' | 'relu' | 'tanh')[] = ['relu', 'relu', 'sigmoid'];
  
  constructor() {
    this.model = new FixedPointMLModel(
      this.preTrainedWeights,
      this.preTrainedBiases,
      this.activations
    );
    
    console.log('🤖 FraudDetectionMLP initialized with pre-trained weights');
    console.log(`📊 Architecture: ${this.inputSize} → ${this.hiddenSizes.join(' → ')} → ${this.outputSize}`);
  }
  
  /**
   * Extract features from transaction data
   */
  extractFeatures(transaction: any): TransactionFeatures {
    const now = new Date();
    const hourOfDay = now.getHours() / 23; // Normalize to 0-1
    const dayOfWeek = now.getDay() / 6; // Normalize to 0-1
    
    // These would typically come from historical data analysis
    const features: TransactionFeatures = {
      amount: this.normalizeAmount(transaction.amount || 0),
      gasPrice: this.normalizeGasPrice(transaction.gasPrice || 0),
      gasLimit: this.normalizeGasLimit(transaction.gasLimit || 0),
      timeOfDay: hourOfDay,
      dayOfWeek: dayOfWeek,
      accountAge: this.normalizeAccountAge(transaction.senderAge || 0),
      transactionCount: this.normalizeTxCount(transaction.dailyTxCount || 0),
      avgAmount: this.normalizeAmount(transaction.avgAmount || 0),
      velocityScore: this.calculateVelocityScore(transaction),
      networkCongestion: this.getNetworkCongestion()
    };
    
    return features;
  }
  
  /**
   * Predict fraud probability for a transaction
   */
  predict(transaction: any): { 
    fraudProbability: number; 
    isFraud: boolean; 
    confidence: number;
    features: TransactionFeatures;
  } {
    const features = this.extractFeatures(transaction);
    
    // Convert features to input array
    const input = [
      features.amount,
      features.gasPrice,
      features.gasLimit,
      features.timeOfDay,
      features.dayOfWeek,
      features.accountAge,
      features.transactionCount,
      features.avgAmount,
      features.velocityScore,
      features.networkCongestion
    ];
    
    console.log('🔍 Fraud detection input features:', {
      amount: features.amount.toFixed(4),
      gasPrice: features.gasPrice.toFixed(4),
      velocityScore: features.velocityScore.toFixed(4),
      networkCongestion: features.networkCongestion.toFixed(4)
    });
    
    // Run inference
    const output = this.model.predict(input);
    const fraudProbability = output[0];
    
    // Decision threshold (could be configurable)
    const threshold = 0.5;
    const isFraud = fraudProbability >= threshold;
    
    // Calculate confidence (distance from decision boundary)
    const confidence = Math.abs(fraudProbability - threshold) * 2;
    
    console.log(`🎯 Fraud prediction: ${(fraudProbability * 100).toFixed(2)}% probability, ${isFraud ? 'FRAUD' : 'LEGITIMATE'}`);
    
    return {
      fraudProbability,
      isFraud,
      confidence,
      features
    };
  }
  
  /**
   * Get model parameters for smart contract deployment
   */
  getContractParameters() {
    const params = this.model.getContractParameters();
    
    return {
      ...params,
      architecture: {
        inputSize: this.inputSize,
        hiddenSizes: this.hiddenSizes,
        outputSize: this.outputSize,
        activations: this.activations
      },
      metadata: {
        version: '1.0.0',
        trained: new Date().toISOString(),
        description: 'Fraud Detection MLP for Blockchain Transactions'
      }
    };
  }
  
  /**
   * Evaluate model performance on test data
   */
  evaluate(testData: FraudDataPoint[]): ModelMetrics {
    const predictions: number[] = [];
    const labels: number[] = [];
    
    for (const dataPoint of testData) {
      const result = this.predict({ 
        amount: this.denormalizeAmount(dataPoint.features.amount),
        gasPrice: this.denormalizeGasPrice(dataPoint.features.gasPrice),
        // ... other transaction properties
      });
      
      predictions.push(result.fraudProbability);
      labels.push(dataPoint.label);
    }
    
    const metrics = calculateMetrics(predictions, labels, 0.5);
    
    console.log('📈 Model Evaluation Metrics:', {
      accuracy: `${(metrics.accuracy * 100).toFixed(2)}%`,
      precision: `${(metrics.precision * 100).toFixed(2)}%`,
      recall: `${(metrics.recall * 100).toFixed(2)}%`,
      f1Score: `${(metrics.f1Score * 100).toFixed(2)}%`
    });
    
    return metrics;
  }
  
  /**
   * Generate synthetic fraud detection training data for testing
   */
  generateSyntheticData(samples: number): FraudDataPoint[] {
    const data: FraudDataPoint[] = [];
    
    for (let i = 0; i < samples; i++) {
      const isFraud = Math.random() < 0.1; // 10% fraud rate
      
      // Generate features based on fraud/legitimate patterns
      const features: TransactionFeatures = {
        amount: isFraud ? Math.random() * 0.3 + 0.7 : Math.random() * 0.7, // Fraudulent txs tend to be larger
        gasPrice: isFraud ? Math.random() * 0.2 + 0.8 : Math.random() * 0.8, // High gas for urgency
        gasLimit: Math.random(),
        timeOfDay: isFraud ? (Math.random() * 0.3 + 0.7) % 1 : Math.random(), // Late night fraud
        dayOfWeek: Math.random(),
        accountAge: isFraud ? Math.random() * 0.3 : Math.random() * 0.7 + 0.3, // New accounts more risky
        transactionCount: isFraud ? Math.random() * 0.2 + 0.8 : Math.random() * 0.6, // High velocity
        avgAmount: Math.random(),
        velocityScore: isFraud ? Math.random() * 0.3 + 0.7 : Math.random() * 0.6,
        networkCongestion: Math.random()
      };
      
      data.push({
        features,
        label: isFraud ? 1 : 0
      });
    }
    
    return data;
  }
  
  // Normalization utility functions
  private normalizeAmount(amount: number): number {
    // Assuming max transaction amount is 1000 ETH equivalent
    return Math.min(amount / 1000, 1);
  }
  
  private denormalizeAmount(normalized: number): number {
    return normalized * 1000;
  }
  
  private normalizeGasPrice(gasPrice: number): number {
    // Assuming max gas price is 500 GWEI
    return Math.min(gasPrice / 500, 1);
  }
  
  private denormalizeGasPrice(normalized: number): number {
    return normalized * 500;
  }
  
  private normalizeGasLimit(gasLimit: number): number {
    // Assuming max gas limit is 10M
    return Math.min(gasLimit / 10000000, 1);
  }
  
  private normalizeAccountAge(ageInDays: number): number {
    // Assuming max relevant age is 1000 days
    return Math.min(ageInDays / 1000, 1);
  }
  
  private normalizeTxCount(count: number): number {
    // Assuming max daily transactions is 100
    return Math.min(count / 100, 1);
  }
  
  private calculateVelocityScore(transaction: any): number {
    // Simplified velocity calculation
    // In production, this would analyze recent transaction patterns
    const recentTxs = transaction.recentTxCount || 1;
    const timeWindow = transaction.timeWindowHours || 24;
    
    return Math.min(recentTxs / (timeWindow * 2), 1);
  }
  
  private getNetworkCongestion(): number {
    // Simplified congestion metric
    // In production, this would query actual network metrics
    return Math.random() * 0.3 + 0.3; // Random between 0.3-0.6
  }
}

/**
 * Factory function to create fraud detection model
 */
export function createFraudDetectionModel(): FraudDetectionMLP {
  return new FraudDetectionMLP();
}

/**
 * Model performance benchmarking
 */
export async function benchmarkModel(): Promise<{
  metrics: ModelMetrics;
  inferenceTime: number;
  memoryUsage: number;
}> {
  console.log('🚀 Starting fraud detection model benchmark...');
  
  const model = createFraudDetectionModel();
  
  // Generate test data
  const testData = model.generateSyntheticData(1000);
  console.log(`📊 Generated ${testData.length} synthetic test samples`);
  
  // Measure inference time
  const startTime = performance.now();
  
  const metrics = model.evaluate(testData);
  
  const endTime = performance.now();
  const inferenceTime = (endTime - startTime) / testData.length; // ms per inference
  
  // Rough memory usage estimate
  const memoryUsage = JSON.stringify(model.getContractParameters()).length;
  
  console.log('✅ Benchmark completed:', {
    inferenceTime: `${inferenceTime.toFixed(3)}ms per prediction`,
    memoryUsage: `${memoryUsage} bytes`,
    accuracy: `${(metrics.accuracy * 100).toFixed(2)}%`
  });
  
  return {
    metrics,
    inferenceTime,
    memoryUsage
  };
}

export default {
  FraudDetectionMLP,
  createFraudDetectionModel,
  benchmarkModel
};