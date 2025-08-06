/**
 * Issue #7: Fixed-Point Mathematics for AI Inference on Smart Contracts
 * 
 * This module provides utilities for converting floating-point operations
 * to fixed-point arithmetic compatible with EVM/Hedera smart contracts.
 * 
 * Based on PRBMath-style fixed-point arithmetic (signed 59.18-decimal)
 * for high-precision ML inference on blockchain.
 */

// Fixed-point precision: 18 decimal places (like PRBMath)
export const FIXED_POINT_SCALE = 18;
export const FIXED_POINT_ONE = BigInt(10 ** FIXED_POINT_SCALE);

/**
 * Convert floating-point number to fixed-point representation
 */
export function floatToFixed(value: number): bigint {
  if (isNaN(value) || !isFinite(value)) {
    throw new Error(`Invalid floating-point value: ${value}`);
  }
  
  // Convert to fixed-point with 18 decimal precision
  const fixedValue = Math.round(value * (10 ** FIXED_POINT_SCALE));
  return BigInt(fixedValue);
}

/**
 * Convert fixed-point number to floating-point representation
 */
export function fixedToFloat(value: bigint): number {
  return Number(value) / (10 ** FIXED_POINT_SCALE);
}

/**
 * Fixed-point addition
 */
export function fixedAdd(a: bigint, b: bigint): bigint {
  return a + b;
}

/**
 * Fixed-point subtraction
 */
export function fixedSub(a: bigint, b: bigint): bigint {
  return a - b;
}

/**
 * Fixed-point multiplication
 * Result = (a * b) / SCALE
 */
export function fixedMul(a: bigint, b: bigint): bigint {
  const product = a * b;
  return product / FIXED_POINT_ONE;
}

/**
 * Fixed-point division
 * Result = (a * SCALE) / b
 */
export function fixedDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) {
    throw new Error("Division by zero");
  }
  
  const numerator = a * FIXED_POINT_ONE;
  return numerator / b;
}

/**
 * Fixed-point exponential function (approximation)
 * Uses Taylor series: e^x ≈ 1 + x + x²/2! + x³/3! + ...
 */
export function fixedExp(x: bigint): bigint {
  // For numerical stability, handle negative inputs
  const isNegative = x < 0n;
  const absX = isNegative ? -x : x;
  
  // Taylor series approximation (first 10 terms)
  let result = FIXED_POINT_ONE; // 1
  let term = FIXED_POINT_ONE;    // Current term
  
  for (let i = 1; i <= 10; i++) {
    term = fixedMul(term, fixedDiv(absX, BigInt(i)));
    result = fixedAdd(result, term);
  }
  
  // If input was negative, return 1/result
  if (isNegative) {
    result = fixedDiv(FIXED_POINT_ONE, result);
  }
  
  return result;
}

/**
 * Sigmoid activation function using fixed-point arithmetic
 * sigmoid(x) = 1 / (1 + e^(-x))
 */
export function fixedSigmoid(x: bigint): bigint {
  const negX = -x;
  const expNegX = fixedExp(negX);
  const denominator = fixedAdd(FIXED_POINT_ONE, expNegX);
  
  return fixedDiv(FIXED_POINT_ONE, denominator);
}

/**
 * ReLU activation function using fixed-point arithmetic
 * relu(x) = max(0, x)
 */
export function fixedRelu(x: bigint): bigint {
  return x > 0n ? x : 0n;
}

/**
 * Tanh activation function using fixed-point arithmetic (approximation)
 * tanh(x) = (e^x - e^(-x)) / (e^x + e^(-x))
 */
export function fixedTanh(x: bigint): bigint {
  const expX = fixedExp(x);
  const expNegX = fixedExp(-x);
  
  const numerator = fixedSub(expX, expNegX);
  const denominator = fixedAdd(expX, expNegX);
  
  return fixedDiv(numerator, denominator);
}

/**
 * Matrix-vector multiplication using fixed-point arithmetic
 * Computes: result = weights * input + bias
 */
export function fixedMatrixVectorMul(
  weights: bigint[][],
  input: bigint[],
  bias: bigint[]
): bigint[] {
  const rows = weights.length;
  const cols = weights[0]?.length || 0;
  
  if (input.length !== cols) {
    throw new Error(`Input size ${input.length} doesn't match weight matrix cols ${cols}`);
  }
  
  if (bias.length !== rows) {
    throw new Error(`Bias size ${bias.length} doesn't match weight matrix rows ${rows}`);
  }
  
  const result: bigint[] = [];
  
  for (let i = 0; i < rows; i++) {
    let sum = bias[i]; // Start with bias
    
    for (let j = 0; j < cols; j++) {
      const product = fixedMul(weights[i][j], input[j]);
      sum = fixedAdd(sum, product);
    }
    
    result.push(sum);
  }
  
  return result;
}

/**
 * Apply activation function to vector
 */
export function applyActivation(
  vector: bigint[],
  activation: 'sigmoid' | 'relu' | 'tanh'
): bigint[] {
  return vector.map(value => {
    switch (activation) {
      case 'sigmoid':
        return fixedSigmoid(value);
      case 'relu':
        return fixedRelu(value);
      case 'tanh':
        return fixedTanh(value);
      default:
        throw new Error(`Unknown activation function: ${activation}`);
    }
  });
}

/**
 * Quantize floating-point weights to 8-bit integers (for TinyML compatibility)
 */
export function quantizeWeights(weights: number[], scale = 127): Int8Array {
  const quantized = new Int8Array(weights.length);
  
  // Find min/max for normalization
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min;
  
  if (range === 0) {
    quantized.fill(0);
    return quantized;
  }
  
  // Quantize to [-127, 127] range
  for (let i = 0; i < weights.length; i++) {
    const normalized = (weights[i] - min) / range; // [0, 1]
    const scaled = normalized * 2 - 1; // [-1, 1]
    quantized[i] = Math.round(scaled * scale);
  }
  
  return quantized;
}

/**
 * Convert quantized weights back to fixed-point representation
 */
export function dequantizeWeights(quantized: Int8Array, scale = 127): bigint[] {
  const result: bigint[] = [];
  
  for (let i = 0; i < quantized.length; i++) {
    const normalized = quantized[i] / scale; // [-1, 1]
    const floatValue = normalized; // Keep in [-1, 1] range
    result.push(floatToFixed(floatValue));
  }
  
  return result;
}

/**
 * Utility class for managing ML model parameters in fixed-point format
 */
export class FixedPointMLModel {
  private weights: bigint[][][];
  private biases: bigint[][];
  private activations: ('sigmoid' | 'relu' | 'tanh')[];
  
  constructor(
    weights: number[][][],
    biases: number[][],
    activations: ('sigmoid' | 'relu' | 'tanh')[]
  ) {
    // Convert all weights and biases to fixed-point
    this.weights = weights.map(layer => 
      layer.map(neuron => 
        neuron.map(weight => floatToFixed(weight))
      )
    );
    
    this.biases = biases.map(layer => 
      layer.map(bias => floatToFixed(bias))
    );
    
    this.activations = activations;
  }
  
  /**
   * Forward pass through the neural network
   */
  predict(input: number[]): number[] {
    // Convert input to fixed-point
    let current = input.map(val => floatToFixed(val));
    
    // Forward pass through each layer
    for (let layerIdx = 0; layerIdx < this.weights.length; layerIdx++) {
      const layerWeights = this.weights[layerIdx];
      const layerBias = this.biases[layerIdx];
      const activation = this.activations[layerIdx];
      
      // Matrix multiplication: output = weights * input + bias
      current = fixedMatrixVectorMul(layerWeights, current, layerBias);
      
      // Apply activation function
      current = applyActivation(current, activation);
    }
    
    // Convert output back to floating-point
    return current.map(val => fixedToFloat(val));
  }
  
  /**
   * Get model parameters in smart contract compatible format
   */
  getContractParameters() {
    return {
      weights: this.weights.map(layer => 
        layer.map(neuron => 
          neuron.map(weight => weight.toString())
        )
      ),
      biases: this.biases.map(layer => 
        layer.map(bias => bias.toString())
      ),
      activations: this.activations
    };
  }
}

/**
 * Performance metrics for model evaluation
 */
export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  truePositiveRate: number;
}

/**
 * Calculate binary classification metrics
 */
export function calculateMetrics(
  predictions: number[],
  labels: number[],
  threshold = 0.5
): ModelMetrics {
  if (predictions.length !== labels.length) {
    throw new Error("Predictions and labels must have same length");
  }
  
  let tp = 0, fp = 0, tn = 0, fn = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i] >= threshold ? 1 : 0;
    const actual = labels[i];
    
    if (predicted === 1 && actual === 1) tp++;
    else if (predicted === 1 && actual === 0) fp++;
    else if (predicted === 0 && actual === 0) tn++;
    else fn++;
  }
  
  const accuracy = (tp + tn) / (tp + fp + tn + fn);
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1Score = (2 * precision * recall) / (precision + recall) || 0;
  const falsePositiveRate = fp / (fp + tn) || 0;
  const truePositiveRate = recall;
  
  return {
    accuracy,
    precision,
    recall,
    f1Score,
    falsePositiveRate,
    truePositiveRate
  };
}

export default {
  floatToFixed,
  fixedToFloat,
  fixedAdd,
  fixedSub,
  fixedMul,
  fixedDiv,
  fixedExp,
  fixedSigmoid,
  fixedRelu,
  fixedTanh,
  fixedMatrixVectorMul,
  applyActivation,
  quantizeWeights,
  dequantizeWeights,
  FixedPointMLModel,
  calculateMetrics,
  FIXED_POINT_SCALE,
  FIXED_POINT_ONE
};