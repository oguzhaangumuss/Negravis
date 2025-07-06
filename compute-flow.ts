#!/usr/bin/env ts-node

import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import OpenAI from "openai";
import dotenv from "dotenv";
import { ChatCompletion } from "openai/src/resources.js";

// Load environment variables
dotenv.config();

// Official 0G providers
const OFFICIAL_PROVIDERS = {
  "llama-3.3-70b-instruct": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "deepseek-r1-70b": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3",
};

const fs = require("fs");
const path = require("path");

// Define the file paths
const claimsFilePath = path.join(__dirname, "test_claims.json");
const contextFilePath = path.join(__dirname, "test_context.md");

interface TestCase {
  category: string;
  id: string;
  claim: string;
  expected: "TRUE" | "FALSE" | "UNDEFINED";
}
interface Claims {
  test_cases: TestCase[];
}

// Negravis/demo-compute-flow.ts#L37-57
async function readClaims(): Promise<Claims> {
  try {
    const data = await fs.promises.readFile(claimsFilePath, "utf8");
    const claims: Claims = JSON.parse(data);
    return claims;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Error reading or parsing claims file: ${err.message}`);
    } else {
      throw new Error(
        `Unknown error reading or parsing claims file: ${String(err)}`
      );
    }
  }
}

// Negravis/demo-compute-flow.ts#L52-61
async function readContext(): Promise<string> {
  try {
    const data = await fs.promises.readFile(contextFilePath, "utf8");
    return data;
  } catch (err: unknown) {
    console.error(`Error reading ${contextFilePath}:`, err);
    // Depending on how you want to handle errors, you might want to re-throw,
    // return an empty string, or return a specific error indicator.
    // For now, re-throwing to be consistent with error handling in readClaims.
    if (err instanceof Error) {
      throw new Error(`Error reading context file: ${err.message}`);
    } else {
      throw new Error(`Unknown error reading context file: ${String(err)}`);
    }
  }
}

// Test configuration
const FALLBACK_FEE = 0.01;
const INITIAL_FUND_AMOUNT = 0.1; // 0.1 OG tokens

async function askOracle(
  claim: string,
  model: string,
  openai: OpenAI,
  requestHeaders: Record<string, string>
): Promise<ChatCompletion> {
  const user_prompt = `What is the truth value of the following claim?\n\n${claim}\n(TRUE|FALSE|UNDEFINED)`;
  console.log("🚀 Asking Oracle to check claim: ", user_prompt);
  const TEST_CONTEXT: string = await readContext();
  console.log("TEST_CONTEXT:", TEST_CONTEXT.substring(0, 100));
  const result = await openai.chat.completions.create(
    {
      messages: [
        {
          role: "system",
          content:
            "You are a helpful, fact checking AI assistant. You will be given a huge amount of information and a claim. Your task is to verify or refute the claim and provide evidence from the information. If you are unsure, you must classify the claim as UNDEFINED.",
        },
        {
          role: "user",
          content: TEST_CONTEXT,
        },
        { role: "user", content: user_prompt },
      ],
      model: model,
      temperature: 0.0,
    },
    {
      headers: requestHeaders,
    }
  );
  return result;
}

async function testComputeFlow() {
  console.log("🚀 Starting 0G Compute Network Flow Demo");
  console.log("=".repeat(50));

  const testClaims: Claims = await readClaims();
  console.log(`Test Claims: ${testClaims.test_cases.length}`);
  let testClaim: TestCase | undefined = testClaims.test_cases[0];
  if (!testClaim) {
    console.log("No test claims found");
    return;
  }
  console.log(`TestQuery: "${testClaim.claim}" (${testClaim.expected})`);

  try {
    // Step 1: Initialize wallet and provider
    console.log("\n📋 Step 1: Initialize Wallet and Provider");
    console.log("-".repeat(30));

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY is required in .env file");
    }

    // Multiple RPC endpoints for failover
    const rpcEndpoints = [
      "https://evmrpc-testnet.0g.ai",
      "https://rpc-testnet.0g.ai",
      "https://solitary-dark-replica.0g-galileo.quiknode.pro/fa3c1846187697dfa72f19acdfffd0d0adb34064/",
    ];

    let provider;
    let connectedEndpoint;

    console.log("⏳ Testing RPC endpoints for connectivity...");

    for (const endpoint of rpcEndpoints) {
      try {
        console.log(`🔍 Testing: ${endpoint}`);
        const testProvider = new ethers.JsonRpcProvider(endpoint);

        // Test connection with a simple call
        await testProvider.getNetwork();

        provider = testProvider;
        connectedEndpoint = endpoint;
        console.log(`✅ Connected to: ${endpoint}`);
        break;
      } catch (error: any) {
        console.log(`❌ Failed to connect to ${endpoint}: ${error.message}`);
        continue;
      }
    }

    if (!provider) {
      throw new Error(
        "All RPC endpoints failed. Please check your internet connection or try again later."
      );
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`✅ Wallet Address: ${wallet.address}`);
    console.log(`✅ Active RPC URL: ${connectedEndpoint}`);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet ETH Balance: ${ethers.formatEther(balance)} ETH`);

    // Step 2: Create broker instance
    console.log("\n📋 Step 2: Create 0G Compute Broker");
    console.log("-".repeat(30));

    console.log("⏳ Creating ZG Compute Network Broker...");
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log("✅ Broker created successfully");

    // Step 3: Check/Setup ledger account
    console.log("\n📋 Step 3: Check/Setup Ledger Account");
    console.log("-".repeat(30));

    let ledgerInfo;
    try {
      ledgerInfo = await broker.ledger.getLedger();
      console.log("✅ Ledger account exists");
      console.log(ledgerInfo);
    } catch (error) {
      console.log("⚠️  Ledger account does not exist, creating...");
      await broker.ledger.addLedger(0.1);
      console.log(`✅ Ledger created with ${INITIAL_FUND_AMOUNT} OG tokens`);

      // Get updated balance
      ledgerInfo = await broker.ledger.getLedger();
      console.log(ledgerInfo);
    }

    // Step 4: List available services
    console.log("\n📋 Step 4: List Available Services");
    console.log("-".repeat(30));

    console.log("⏳ Fetching available services...");
    const services = await broker.inference.listService();
    console.log(`✅ Found ${services.length} available services`);

    services.forEach((service: any, index: number) => {
      const modelName =
        Object.entries(OFFICIAL_PROVIDERS).find(
          ([_, addr]) => addr === service.provider
        )?.[0] || "Unknown";
      console.log(`\n🤖 Service ${index + 1}:`);
      console.log(`   Model: ${modelName}`);
      console.log(`   Provider: ${service.provider}`);
      console.log(`   Service Type: ${service.serviceType}`);
      console.log(`   URL: ${service.url}`);
      console.log(
        `   Input Price: ${ethers.formatEther(service.inputPrice || 0)} OG`
      );
      console.log(
        `   Output Price: ${ethers.formatEther(service.outputPrice || 0)} OG`
      );
      console.log(`   Verifiability: ${service.verifiability || "None"}`);
    });

    // Step 5: Select provider and acknowledge
    // Note: This step is only required for the first time you use a provider. No need to run it again.
    console.log("\n📋 Step 5: Select Provider and Acknowledge");
    console.log("-".repeat(30));

    // Use the first official provider (llama-3.3-70b-instruct)
    const selectedProvider = OFFICIAL_PROVIDERS["llama-3.3-70b-instruct"];
    console.log(
      `🎯 Selected Provider: ${selectedProvider} (llama-3.3-70b-instruct)`
    );

    console.log("⏳ Acknowledging provider...");
    try {
      await broker.inference.acknowledgeProviderSigner(selectedProvider);
      console.log("✅ Provider acknowledged successfully");
    } catch (error: any) {
      if (error.message.includes("already acknowledged")) {
        console.log("✅ Provider already acknowledged");
      } else {
        throw error;
      }
    }

    // Step 6: Get service metadata
    console.log("\n📋 Step 6: Get Service Metadata");
    console.log("-".repeat(30));

    console.log("⏳ Fetching service metadata...");
    const { endpoint, model } = await broker.inference.getServiceMetadata(
      selectedProvider
    );
    console.log(`✅ Service Endpoint: ${endpoint}`);
    console.log(`✅ Model Name: ${model}`);

    // Step 7: Generate authentication headers
    console.log("\n📋 Step 7: Generate Authentication Headers");
    console.log("-".repeat(30));

    console.log("⏳ Generating authentication headers...");
    const headers = await broker.inference.getRequestHeaders(
      selectedProvider,
      testClaim.claim
    );
    console.log("✅ Authentication headers generated (single-use)");
    console.log(`📝 Headers keys: ${Object.keys(headers).join(", ")}`);

    // Step 8: Send query to AI service
    console.log("\n📋 Step 8: Send Query to AI Service");
    console.log("-".repeat(30));

    console.log(`💬 Query: "${testClaim.claim}"`);
    console.log("⏳ Creating OpenAI client and sending request...");

    // Create OpenAI client with service endpoint
    const openai = new OpenAI({
      baseURL: endpoint,
      apiKey: "", // Empty string as per 0G docs
    });

    // Prepare headers for OpenAI client
    const requestHeaders: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        requestHeaders[key] = value;
      }
    });

    // Send the query
    const completion: ChatCompletion = await askOracle(
      testClaim.claim,
      model,
      openai,
      requestHeaders
    );

    const aiResponse = completion.choices[0].message.content;
    const chatId = completion.id;

    console.log("✅ AI query completed successfully");
    console.log(
      `🤖 AI Response: ${aiResponse} (Expected: ${testClaim.expected})`
    );
    console.log(`🆔 Chat ID: ${chatId}`);

    // Step 9: Process response and handle payment
    console.log("\n📋 Step 9: Process Response and Handle Payment");
    console.log("-".repeat(30));

    console.log("⏳ Processing response and verifying payment...");
    try {
      const isValid = await broker.inference.processResponse(
        selectedProvider,
        aiResponse || "",
        chatId
      );

      console.log("✅ Response processed successfully");
      console.log(`🔍 Verification Status: ${isValid ? "Valid" : "Invalid"}`);

      if (isValid) {
        console.log("✅ Payment processed automatically");
      }
    } catch (paymentError: any) {
      console.log("⚠️  Payment processing failed, attempting fallback...");
      console.log(`❌ Payment Error: ${paymentError.message}`);
    }

    // Step 10: Check final ledger balance
    console.log("\n📋 Step 10: Check Final Balance");
    console.log("-".repeat(30));

    const finalBalance = await broker.ledger.getLedger();
    console.log(finalBalance);

    // Calculate approximate cost
    // ledgerInfo structure: { ledgerInfo: [balance, ...], infers: [...], fines: [...] }
    const initialBalanceNum = parseFloat(
      ethers.formatEther(ledgerInfo.ledgerInfo[0])
    );
    const finalBalanceNum = parseFloat(
      ethers.formatEther(finalBalance.ledgerInfo[0])
    );
    const cost = initialBalanceNum - finalBalanceNum;

    if (cost > 0) {
      console.log(`💸 Approximate Query Cost: ${cost.toFixed(6)} OG`);
    }

    // Step 11: Summary
    console.log("\n📋 Step 11: Demo Summary");
    console.log("-".repeat(30));

    console.log("✅ 0G Compute Network flow completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   • Provider: llama-3.3-70b-instruct`);
    console.log(`   • Query: "${testClaim.claim}" (${testClaim.expected})`);
    console.log(`   • Response: "${aiResponse?.substring(0, 100)}..."`);
    console.log(`   • Verification: TEE-based (TeeML)`);
    console.log(`   • Payment: Automatic micropayment`);

    console.log("\n🎉 Demo completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Demo failed with error:");
    console.error(`Error: ${error.message}`);
    console.error("\nFull error details:");
    console.error(error);

    console.log("\n🔧 Troubleshooting tips:");
    console.log("1. Ensure PRIVATE_KEY is set in .env file");
    console.log("2. Ensure wallet has sufficient testnet ETH");
    console.log("3. Check network connectivity");
    console.log("4. Verify 0G testnet is accessible");

    process.exit(1);
  }
}

// Helper function to format console output
function formatSection(title: string) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🔷 ${title}`);
  console.log(`${"=".repeat(50)}`);
}

// Run the test
if (require.main === module) {
  testComputeFlow()
    .then(() => {
      console.log("\n✨ Script execution completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script execution failed:", error);
      process.exit(1);
    });
}

export { testComputeFlow };
