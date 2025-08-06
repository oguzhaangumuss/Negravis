import { IIdentityProvider, LicenseData } from '../../../interfaces/HFSLicenseManager';

/**
 * Mock DMV Identity Provider
 * Simulates government DMV verification service
 */
export class MockDMVProvider implements IIdentityProvider {
  public readonly name = 'Mock DMV Provider';
  public readonly type = 'government_dmv' as const;

  /**
   * Verify driver's license document with mock DMV database
   */
  async verifyDocument(licenseData: LicenseData): Promise<{
    verified: boolean;
    confidence: number;
    details: string;
  }> {
    try {
      console.log(`🔍 DMV: Verifying license ${licenseData.licenseNumber} from ${licenseData.issuingAuthority}`);
      
      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock verification logic
      const isValidFormat = this.validateLicenseFormat(licenseData.licenseNumber);
      const isValidAuthority = this.validateIssuingAuthority(licenseData.issuingAuthority);
      const isNotExpired = new Date() < licenseData.expirationDate;
      
      // Simulate some licenses being invalid for demo
      const shouldFail = licenseData.licenseNumber.includes('FAKE') || 
                        licenseData.licenseNumber.includes('TEST');
      
      const verified = isValidFormat && isValidAuthority && isNotExpired && !shouldFail;
      const confidence = verified ? 0.95 : 0.1;
      
      const details = verified 
        ? `License verified: ${licenseData.documentType} from ${licenseData.issuingAuthority}`
        : `Verification failed: ${!isValidFormat ? 'Invalid format' : !isValidAuthority ? 'Unknown authority' : !isNotExpired ? 'Expired' : 'Flagged as fake'}`;
      
      console.log(`${verified ? '✅' : '❌'} DMV verification: ${details}`);
      
      return {
        verified,
        confidence,
        details
      };
      
    } catch (error: any) {
      console.error('❌ DMV verification error:', error.message);
      return {
        verified: false,
        confidence: 0,
        details: `Verification service error: ${error.message}`
      };
    }
  }

  /**
   * Check if license has been revoked
   */
  async checkRevocationStatus(licenseNumber: string, authority: string): Promise<{
    revoked: boolean;
    reason?: string;
  }> {
    try {
      console.log(`🔍 DMV: Checking revocation status for ${licenseNumber}`);
      
      // Simulate revocation check delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock revocation database
      const revokedLicenses = [
        'DL12345REVOKED',
        'CA98765SUSPENDED',
        'TX11111INVALID'
      ];
      
      const revoked = revokedLicenses.includes(licenseNumber);
      const reason = revoked ? 'License suspended due to violations' : undefined;
      
      console.log(`${revoked ? '🚫' : '✅'} DMV revocation check: ${revoked ? 'REVOKED' : 'Active'}`);
      
      return { revoked, reason };
      
    } catch (error: any) {
      console.error('❌ DMV revocation check error:', error.message);
      return {
        revoked: false // Default to not revoked on error
      };
    }
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: this.name,
      type: this.type,
      version: '1.0.0',
      description: 'Mock DMV provider for testing license verification',
      supportedDocuments: ['drivers_license'],
      coverage: ['US', 'CA'] // US states and Canada
    };
  }

  /**
   * Health check for DMV service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simulate service check
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (error) {
      console.error('❌ DMV service health check failed:', error);
      return false;
    }
  }

  // Private helper methods
  private validateLicenseFormat(licenseNumber: string): boolean {
    // Simple format validation
    return !!(licenseNumber && 
           licenseNumber.length >= 6 && 
           licenseNumber.length <= 20 &&
           /^[A-Z0-9]+$/.test(licenseNumber));
  }

  private validateIssuingAuthority(authority: string): boolean {
    // Known authorities list (mock)
    const knownAuthorities = [
      'California DMV',
      'Texas DPS',
      'New York DMV',
      'Florida DHSMV',
      'Ontario MTO',
      'BC ICBC'
    ];
    
    return knownAuthorities.some(known => 
      authority.toLowerCase().includes(known.toLowerCase())
    );
  }
}

// Export singleton instance
export const mockDMVProvider = new MockDMVProvider();