const express = require('express');
const router = express.Router();
const { exportDatabase, importDatabase } = require('../controllers/exportImportController');

router.get('/export', exportDatabase);
router.post('/import', importDatabase);

module.exports = router;
