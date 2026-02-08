const express = require('express');
const router = express.Router();
const tracksController = require('../controllers/tracksController');

router.get('/', tracksController.getAllTracks);
router.get('/:id', tracksController.getTrackById);
router.post('/', tracksController.createTrack);
router.delete('/:id', tracksController.deleteTrack);

module.exports = router;
