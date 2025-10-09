const express = require('express');
const router = express.Router();
const miscController = require('../controllers/miscController');

router.get('/unread-counts', miscController.getUnreadCounts);

router.get('/last-active', miscController.getLastActive);

module.exports = router;
