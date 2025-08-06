import express, { Request, Response } from 'express';
import multer from 'multer';
import { hfsLicenseManager } from '../services/hfs/hfsLicenseManager';
import { 
  LicenseStorageRequest, 
  LicenseData, 
  PrivacySettings, 
  ComplianceMetadata 
} from '../interfaces/HFSLicenseManager';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024, // 1MB limit (HFS supports up to 1024 kB)
  },
  fileFilter: (req, file, cb) => {
    // Accept common document formats
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

/**
 * @swagger
 * /api/hfs/license/store:
 *   post:
 *     summary: Store license document on Hedera File Service
 *     tags: [HFS License Storage]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: document
 *         type: file
 *         required: true
 *         description: License document file (image/pdf)
 *       - in: formData
 *         name: licenseData
 *         type: string
 *         required: true
 *         description: JSON string with license metadata
 *     responses:
 *       200:
 *         description: License stored successfully
 *       400:
 *         description: Invalid request or file format
 */
router.post('/license/store', upload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No document file provided'
      });
    }

    if (!req.body.licenseData) {
      return res.status(400).json({
        success: false,
        error: 'License data is required'
      });
    }

    // Parse license data from form
    const licenseData: LicenseData = JSON.parse(req.body.licenseData);
    
    // Validate document
    const isValid = await hfsLicenseManager.validateDocument(req.file.buffer);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document format'
      });
    }

    // Default privacy settings
    const privacySettings: PrivacySettings = {
      dataMinimization: true,
      consentGiven: req.body.consentGiven === 'true' || false,
      consentTimestamp: new Date(),
      dataRetentionPeriod: parseInt(req.body.retentionPeriod) || 365,
      allowDataPortability: true,
      allowDataDeletion: true
    };

    // Default compliance settings
    const complianceRequirements: ComplianceMetadata = {
      hipaaCompliant: true,
      gdprCompliant: true,
      encryptionLevel: 'AES256',
      accessLogEnabled: true,
      auditTrailComplete: true
    };

    // Create storage request
    const storageRequest: LicenseStorageRequest = {
      licenseData,
      documentBuffer: req.file.buffer,
      privacySettings,
      complianceRequirements
    };

    const result = await hfsLicenseManager.storeLicense(storageRequest);

    res.json({
      success: result.success,
      data: {
        fileId: result.fileId,
        licenseHash: result.licenseHash,
        transactionId: result.transactionId,
        storageTimestamp: result.storageTimestamp,
        complianceStatus: result.complianceStatus
      },
      error: result.error
    });

  } catch (error: any) {
    console.error('❌ HFS store license API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/license/verify/{hash}:
 *   get:
 *     summary: Verify license by hash
 *     tags: [HFS License Storage]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: License document hash
 *     responses:
 *       200:
 *         description: License verification result
 */
router.get('/license/verify/:hash', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const { hash } = req.params;
    
    if (!hash) {
      return res.status(400).json({
        success: false,
        error: 'License hash is required'
      });
    }

    const verification = await hfsLicenseManager.verifyLicense(hash);
    
    res.json({
      success: true,
      data: {
        licenseHash: verification.licenseHash,
        documentType: verification.documentType,
        issuingAuthority: verification.issuingAuthority,
        expirationDate: verification.expirationDate,
        verificationStatus: verification.verificationStatus,
        verificationTimestamp: verification.verificationTimestamp,
        confidence: verification.confidence,
        isExpired: new Date() > verification.expirationDate
      }
    });

  } catch (error: any) {
    console.error('❌ HFS verify license API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/license/retrieve/{fileId}:
 *   get:
 *     summary: Retrieve license document from HFS
 *     tags: [HFS License Storage]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: HFS File ID
 *       - in: query
 *         name: requestorId
 *         schema:
 *           type: string
 *         description: Requestor account ID for audit logging
 *     responses:
 *       200:
 *         description: License document retrieved
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/license/retrieve/:fileId', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const { fileId } = req.params;
    const requestorId = req.query.requestorId as string || 'anonymous';
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    const documentBuffer = await hfsLicenseManager.retrieveLicense(fileId, requestorId);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="license_${fileId}"`);
    res.send(documentBuffer);

  } catch (error: any) {
    console.error('❌ HFS retrieve license API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/license/revoke:
 *   post:
 *     summary: Revoke a license
 *     tags: [HFS License Storage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               licenseHash:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: License revoked successfully
 */
router.post('/license/revoke', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const { licenseHash, reason } = req.body;
    
    if (!licenseHash || !reason) {
      return res.status(400).json({
        success: false,
        error: 'License hash and reason are required'
      });
    }

    const revoked = await hfsLicenseManager.revokeLicense(licenseHash, reason);
    
    res.json({
      success: revoked,
      data: {
        licenseHash,
        reason,
        revokedTimestamp: new Date()
      }
    });

  } catch (error: any) {
    console.error('❌ HFS revoke license API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/privacy/export/{userAccountId}:
 *   get:
 *     summary: Export user data (GDPR Data Portability)
 *     tags: [HFS Privacy & Compliance]
 *     parameters:
 *       - in: path
 *         name: userAccountId
 *         required: true
 *         schema:
 *           type: string
 *         description: User account ID
 *     responses:
 *       200:
 *         description: User data exported successfully
 */
router.get('/privacy/export/:userAccountId', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const { userAccountId } = req.params;
    
    const userData = await hfsLicenseManager.exportUserData(userAccountId);
    
    res.json({
      success: true,
      data: userData,
      compliance: {
        regulation: 'GDPR',
        right: 'Data Portability (Article 20)',
        exportTimestamp: new Date()
      }
    });

  } catch (error: any) {
    console.error('❌ HFS export data API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/privacy/delete/{userAccountId}:
 *   delete:
 *     summary: Delete user data (GDPR Right to be Forgotten)
 *     tags: [HFS Privacy & Compliance]
 *     parameters:
 *       - in: path
 *         name: userAccountId
 *         required: true
 *         schema:
 *           type: string
 *         description: User account ID
 *     responses:
 *       200:
 *         description: User data deleted successfully
 */
router.delete('/privacy/delete/:userAccountId', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const { userAccountId } = req.params;
    
    const deleted = await hfsLicenseManager.deleteUserData(userAccountId);
    
    res.json({
      success: deleted,
      data: {
        userAccountId,
        deletionTimestamp: new Date()
      },
      compliance: {
        regulation: 'GDPR',
        right: 'Right to be Forgotten (Article 17)',
        status: deleted ? 'completed' : 'failed'
      }
    });

  } catch (error: any) {
    console.error('❌ HFS delete data API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/audit/access-logs/{fileId}:
 *   get:
 *     summary: Get access logs for a file
 *     tags: [HFS Audit & Monitoring]
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: HFS File ID
 *     responses:
 *       200:
 *         description: Access logs retrieved successfully
 */
router.get('/audit/access-logs/:fileId', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const { fileId } = req.params;
    
    const accessLogs = await hfsLicenseManager.getAccessLogs(fileId);
    
    res.json({
      success: true,
      data: {
        fileId,
        totalAccess: accessLogs.length,
        logs: accessLogs.map(log => ({
          accessId: log.accessId,
          accessorAccountId: log.accessorAccountId,
          accessTimestamp: log.accessTimestamp,
          accessType: log.accessType,
          success: log.success,
          reason: log.reason
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ HFS access logs API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/stats:
 *   get:
 *     summary: Get HFS storage statistics
 *     tags: [HFS System]
 *     responses:
 *       200:
 *         description: Storage statistics retrieved successfully
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!hfsLicenseManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'HFS License Manager not ready'
      });
    }

    const stats = await hfsLicenseManager.getStorageStats();
    
    res.json({
      success: true,
      data: {
        storage: stats,
        system: {
          isReady: hfsLicenseManager.isReady(),
          timestamp: new Date()
        }
      }
    });

  } catch (error: any) {
    console.error('❌ HFS stats API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/hfs/health:
 *   get:
 *     summary: HFS system health check
 *     tags: [HFS System]
 *     responses:
 *       200:
 *         description: System healthy
 *       503:
 *         description: System unhealthy
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await hfsLicenseManager.healthCheck();
    
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: isHealthy,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        isReady: hfsLicenseManager.isReady(),
        timestamp: new Date()
      }
    });

  } catch (error: any) {
    console.error('❌ HFS health check API error:', error.message);
    res.status(503).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});

export default router;