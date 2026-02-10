const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

router.get('/dashboard-tracks', configController.getDashboardTracks);
router.put('/dashboard-tracks', configController.setDashboardTracks);
router.get('/dashboard-title', configController.getDashboardTitle);
router.put('/dashboard-title', configController.setDashboardTitle);
router.get('/dashboard-up', configController.getDashboardUp);
router.put('/dashboard-up', configController.setDashboardUp);
router.get('/disabled-drivers', configController.getDisabledDrivers);
router.put('/disabled-drivers', configController.setDisabledDrivers);
router.get('/track-outline/track-ids', configController.getTrackOutlineTrackIds);
router.get('/track-outline/:trackId', configController.getTrackOutlineImage);
router.put('/track-outline/:trackId', configController.setTrackOutlineImage);
router.get('/track-outline/:trackId/exists', configController.hasTrackOutline);
router.get('/carousel-interval', configController.getCarouselInterval);
router.put('/carousel-interval', configController.setCarouselInterval);

module.exports = router;
