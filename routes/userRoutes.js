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

module.exports = router;
