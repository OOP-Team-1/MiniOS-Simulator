import express from 'express';
import { getLatestTelemetry, sendCommand, killEngine, startEngine } from '../engine/processManager.js';

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

router.post('/engine/stop', (req, res) => {
    killEngine();
    res.status(200).json({ status: 'OK', message: 'Engine stopped' });
});

router.post('/engine/start', (req, res) => {
    startEngine();
    setTimeout(() => sendCommand("STATE"), 200);
    res.status(200).json({ status: 'OK', message: 'Engine started' });
});

export default router;