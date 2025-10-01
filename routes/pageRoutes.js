const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');

// User list page after login
router.get('/users', pageController.renderUserList);

module.exports = router;
// Chat page between two users
router.get('/chat', pageController.renderChatPage);
