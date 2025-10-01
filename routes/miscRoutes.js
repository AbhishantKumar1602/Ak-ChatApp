const express = require('express');
const router = express.Router();
const miscController = require('../controllers/miscController');

// Unread counts
router.get('/unread-counts', miscController.getUnreadCounts);
// Last active
router.get('/last-active', miscController.getLastActive);

module.exports = router;
