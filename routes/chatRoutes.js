const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/chat-history', chatController.getChatHistory);

router.post('/chat/clear', chatController.clearChat);

module.exports = router;
