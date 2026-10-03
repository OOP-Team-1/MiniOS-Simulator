import express from 'express';
import { getLatestTelemetry, sendCommand } from '../engine/processManager.js';

const router = express.Router();

router.get('/state', (req, res) => {
    const telemetry = getLatestTelemetry();
    if (!telemetry) {
        return res.status(503).json({ error: 'Engine telemetry not yet available' });
    }
    res.status(200).json(telemetry);
});

router.post('/step', (req, res) => {
    sendCommand("STEP");
    res.status(200).json({ status: 'OK', message: 'Step command dispatched' });
});

export default router;