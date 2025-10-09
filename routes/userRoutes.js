const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Registration
router.post('/register', userController.register);
// Login
router.post('/login', userController.login);
// User list
router.get('/userlist', userController.getUserList);
// Logout
router.post('/logout', userController.logout);

// Friend request system
router.post('/friend-request', userController.sendFriendRequest);
router.post('/friend-request/respond', userController.respondFriendRequest);
router.get('/friend-requests', userController.getFriendRequests);
router.get('/contacts', userController.getContacts);

// Remove friend
router.post('/remove-friend', userController.removeFriend);

module.exports = router;
