const express = require('express');
const router = express.Router();
const lapsController = require('../controllers/lapsController');

router.get('/', lapsController.getAllLaps);
router.get('/track/:trackId', lapsController.getFastestLapsByTrack);
router.get('/fastest-by-track-name', lapsController.getFastestLapByTrackName);
router.get('/fastest-by-track-name-and-driver', lapsController.getFastestLapByTrackNameAndDriver);
router.delete('/by-driver', lapsController.deleteLapsByDriver);
router.post('/', lapsController.createLap);
router.patch('/:id', lapsController.updateLap);
router.delete('/:id', lapsController.deleteLap);

module.exports = router;
