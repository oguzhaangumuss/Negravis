/**
 * Hedera File Service (HFS) License Manager Interface
 * For secure, immutable storage of driver's licenses and identity documents
 */

export interface LicenseData {
  documentHash: string;
  documentType: 'drivers_license' | 'passport' | 'national_id' | 'professional_license';
  issuingAuthority: string;
  holderName: string;
  licenseNumber: string;
  issueDate: Date;
  expirationDate: Date;
  metadata: {
    country: string;
    state?: string;
    category?: string; // For driver's license: A, B, C, etc.
    restrictions?: string[];
  };
}

export interface LicenseVerification {
  licenseHash: string;
  documentType: string;
  issuingAuthority: string;
  expirationDate: Date;
  verificationStatus: 'pending' | 'verified' | 'expired' | 'revoked' | 'invalid';
  verificationTimestamp: Date;
  fileId?: string; // HFS File ID
  confidence: number; // 0-1, verification confidence level
}

export interface PrivacySettings {
  dataMinimization: boolean;
  consentGiven: boolean;
  consentTimestamp: Date;
  dataRetentionPeriod: number; // Days
  allowDataPortability: boolean;
  allowDataDeletion: boolean; // GDPR Right to be forgotten
}

export interface ComplianceMetadata {
  hipaaCompliant: boolean;
  gdprCompliant: boolean;
  encryptionLevel: 'AES256' | 'RSA2048' | 'ECDSA';
  accessLogEnabled: boolean;
  auditTrailComplete: boolean;
}

export interface LicenseStorageRequest {
  licenseData: LicenseData;
  documentBuffer: Buffer; // Encrypted document content
  privacySettings: PrivacySettings;
  complianceRequirements: ComplianceMetadata;
}

export interface LicenseStorageResponse {
  success: boolean;
  fileId: string; // HFS File ID
  licenseHash: string;
  transactionId: string;
  storageTimestamp: Date;
  complianceStatus: ComplianceMetadata;
  error?: string;
}

export interface AccessAuditLog {
  accessId: string;
  fileId: string;
  accessorAccountId: string;
  accessTimestamp: Date;
  accessType: 'read' | 'verify' | 'update' | 'delete';
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

/**
 * Main HFS License Manager Interface
 */
export interface IHFSLicenseManager {
  // Core HFS Operations
  storeLicense(request: LicenseStorageRequest): Promise<LicenseStorageResponse>;
  retrieveLicense(fileId: string, requestorId: string): Promise<Buffer>;
  verifyLicense(licenseHash: string): Promise<LicenseVerification>;
  revokeLicense(licenseHash: string, reason: string): Promise<boolean>;
  
  // Privacy & Compliance
  deleteUserData(userAccountId: string): Promise<boolean>; // GDPR Right to be forgotten
  exportUserData(userAccountId: string): Promise<any>; // GDPR Data portability
  updateConsentSettings(userAccountId: string, settings: PrivacySettings): Promise<boolean>;
  
  // Audit & Monitoring
  getAccessLogs(fileId: string): Promise<AccessAuditLog[]>;
  getComplianceReport(userAccountId: string): Promise<ComplianceMetadata>;
  
  // Utility Methods
  validateDocument(documentBuffer: Buffer): Promise<boolean>;
  generateDocumentHash(documentBuffer: Buffer): Promise<string>;
  checkExpiration(licenseHash: string): Promise<boolean>;
  
  // System Health
  healthCheck(): Promise<boolean>;
  getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    activeVerifications: number;
    expiredDocuments: number;
  }>;
}

/**
 * Identity Provider Integration Interface
 */
export interface IIdentityProvider {
  name: string;
  type: 'government_dmv' | 'kyc_service' | 'blockchain_identity' | 'third_party';
  
  verifyDocument(licenseData: LicenseData): Promise<{
    verified: boolean;
    confidence: number;
    details: string;
  }>;
  
  checkRevocationStatus(licenseNumber: string, authority: string): Promise<{
    revoked: boolean;
    reason?: string;
  }>;
}

/**
 * Zero-Knowledge Proof Interface for Privacy-Preserving Verification
 */
export interface IZKProofManager {
  generateAgeProof(licenseHash: string, minimumAge: number): Promise<{
    proof: string;
    isValid: boolean;
  }>;
  
  generateResidencyProof(licenseHash: string, requiredState: string): Promise<{
    proof: string;
    isValid: boolean;
  }>;
  
  verifyProof(proof: string, claim: string): Promise<boolean>;
}