import express from 'express';

const router = express.Router();

// GET /api/health
// A simple health check to verify the Node.js server is active
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        message: 'MiniOS Simulator Backend is running.',
        timestamp: new Date().toISOString()
    });
});

export default router;