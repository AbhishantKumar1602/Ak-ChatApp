const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Chat history
router.get('/chat-history', chatController.getChatHistory);

module.exports = router;
