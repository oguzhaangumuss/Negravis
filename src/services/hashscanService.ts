/**
 * HashScan Explorer Integration Service
 * Provides enhanced transaction tracking and explorer integration
 */
export interface TransactionDetails {
  transactionId: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  fee: string;
  result: string;
  explorerUrl: string;
}

export interface AccountDetails {
  accountId: string;
  balance: string;
  transactions: number;
  explorerUrl: string;
}

export interface TopicDetails {
  topicId: string;
  messages: number;
  lastMessage: string;
  explorerUrl: string;
}

export interface ContractDetails {
  contractId: string;
  bytecode: string;
  calls: number;
  explorerUrl: string;
}

export class HashScanService {
  private readonly baseUrl = 'https://hashscan.io';
  private readonly network = 'testnet'; // or 'mainnet'
  
  /**
   * Generate explorer URL for any Hedera entity
   */
  generateExplorerUrl(type: 'transaction' | 'account' | 'topic' | 'contract', id: string): string {
    return `${this.baseUrl}/${this.network}/${type}/${id}`;
  }

  /**
   * Create clickable HashScan link with metadata
   */
  createExplorerLink(type: 'transaction' | 'account' | 'topic' | 'contract', id: string, label?: string): object {
    return {
      id,
      type,
      label: label || id,
      url: this.generateExplorerUrl(type, id),
      shortUrl: `hashscan.io/.../${id.split('.').pop()}`,
      isActive: true
    };
  }

  /**
   * Get transaction status and details
   */
  async getTransactionDetails(transactionId: string): Promise<TransactionDetails> {
    // Note: This would typically make an API call to HashScan or Hedera Mirror Node
    // For now, we'll return a mock response with proper structure
    
    return {
      transactionId,
      status: 'success', // Would be determined from actual API response
      timestamp: new Date().toISOString(),
      fee: '0.0001 ℏ',
      result: 'SUCCESS',
      explorerUrl: this.generateExplorerUrl('transaction', transactionId)
    };
  }

  /**
   * Get account information
   */
  async getAccountDetails(accountId: string): Promise<AccountDetails> {
    return {
      accountId,
      balance: '1000.5 ℏ', // Would come from actual API
      transactions: 150,    // Would come from actual API
      explorerUrl: this.generateExplorerUrl('account', accountId)
    };
  }

  /**
   * Get topic information and message count
   */
  async getTopicDetails(topicId: string): Promise<TopicDetails> {
    return {
      topicId,
      messages: 42,        // Would come from actual API
      lastMessage: '5 minutes ago',
      explorerUrl: this.generateExplorerUrl('topic', topicId)
    };
  }

  /**
   * Get contract information
   */
  async getContractDetails(contractId: string): Promise<ContractDetails> {
    return {
      contractId,
      bytecode: '0x608060405234801561001057600080fd5b50...', // Truncated
      calls: 25,           // Would come from actual API
      explorerUrl: this.generateExplorerUrl('contract', contractId)
    };
  }

  /**
   * Create embedded widget HTML for HashScan
   */
  generateEmbedWidget(type: 'transaction' | 'account' | 'topic' | 'contract', id: string): string {
    const url = this.generateExplorerUrl(type, id);
    
    return `
      <div class="hashscan-widget" data-type="${type}" data-id="${id}">
        <div class="widget-header">
          <h4>HashScan Explorer</h4>
          <a href="${url}" target="_blank" class="external-link">View Full Details →</a>
        </div>
        <div class="widget-content">
          <iframe 
            src="${url}?embed=true" 
            width="100%" 
            height="400"
            frameborder="0"
            sandbox="allow-scripts allow-same-origin">
          </iframe>
        </div>
      </div>
    `;
  }

  /**
   * Get real-time status for multiple transactions
   */
  async getMultipleTransactionStatus(transactionIds: string[]): Promise<TransactionDetails[]> {
    const results: TransactionDetails[] = [];
    
    for (const txId of transactionIds) {
      try {
        const details = await this.getTransactionDetails(txId);
        results.push(details);
      } catch (error) {
        console.error(`Failed to get details for transaction ${txId}:`, error);
        // Add failed transaction with error status
        results.push({
          transactionId: txId,
          status: 'failed',
          timestamp: new Date().toISOString(),
          fee: '0 ℏ',
          result: 'ERROR',
          explorerUrl: this.generateExplorerUrl('transaction', txId)
        });
      }
    }
    
    return results;
  }

  /**
   * Create transaction history table data
   */
  formatTransactionHistory(transactions: TransactionDetails[]): object[] {
    return transactions.map(tx => ({
      id: tx.transactionId,
      status: tx.status,
      timestamp: tx.timestamp,
      fee: tx.fee,
      result: tx.result,
      explorerLink: {
        url: tx.explorerUrl,
        text: 'View on HashScan'
      },
      shortId: tx.transactionId.split('@')[0] // Show only the account.realm.num part
    }));
  }

  /**
   * Generate visual status badge
   */
  getStatusBadge(status: 'pending' | 'success' | 'failed'): object {
    const badges = {
      pending: { color: 'orange', icon: '⏳', text: 'Pending' },
      success: { color: 'green', icon: '✅', text: 'Success' },
      failed: { color: 'red', icon: '❌', text: 'Failed' }
    };
    
    return badges[status];
  }

  /**
   * Create comprehensive explorer data for API responses
   */
  createExplorerResponse(type: 'transaction' | 'account' | 'topic' | 'contract', id: string, additionalData?: any): object {
    const baseResponse = {
      id,
      type,
      explorer: {
        url: this.generateExplorerUrl(type, id),
        network: this.network,
        provider: 'HashScan'
      },
      links: {
        web: this.generateExplorerUrl(type, id),
        api: `https://mainnet-public.mirrornode.hedera.com/api/v1/${type}s/${id}`,
        embed: `${this.generateExplorerUrl(type, id)}?embed=true`
      },
      metadata: {
        createdAt: new Date().toISOString(),
        network: this.network,
        verified: true
      }
    };

    return { ...baseResponse, ...additionalData };
  }
}

// Export singleton instance
export const hashscanService = new HashScanService();