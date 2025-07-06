import express from 'express';
import * as serviceController from '../controllers/serviceController';

const router = express.Router();

// Service routes
router.get('/list', serviceController.listServices);
router.post('/query', serviceController.sendQuery);
router.post('/settle-fee', serviceController.settleFee);
router.post('/acknowledge-provider', serviceController.acknowledgeProvider);

// Oracle-specific routes
router.post('/oracle/chat', serviceController.oracleChat);
router.get('/oracle/models', serviceController.getOracleModels);
router.get('/oracle/status', serviceController.getOracleStatus);

export default router;