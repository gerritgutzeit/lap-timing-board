const express = require('express');
const router = express.Router();
const telemetryService = require('../udp/telemetryService');
const configController = require('../controllers/configController');

router.get('/live', (req, res) => {
  try {
    const state = telemetryService.getState();
    const alias = configController.getDriverAliasValue();
    if (alias != null && alias !== '') {
      state.driverName = alias;
    }
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
