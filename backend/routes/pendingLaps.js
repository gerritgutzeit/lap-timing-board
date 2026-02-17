const express = require('express');
const router = express.Router();
const pendingLapsController = require('../controllers/pendingLapsController');

router.get('/', pendingLapsController.list);
router.post('/', pendingLapsController.create);
router.patch('/:id', pendingLapsController.update);
router.delete('/:id', pendingLapsController.remove);
router.post('/:id/confirm', pendingLapsController.confirm);

module.exports = router;
