const User = require('../models/User');
const Chat = require('../models/Chat');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ message: 'All fields required' });
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(400).json({ message: 'Username or email already exists' });
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashed });
        await user.save();
        if (req.io) req.io.emit('update userlist');
        res.status(201).json({ message: 'User registered' });
    } catch (err) {
        res.status(500).json({ message: 'Registration failed', error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) return res.status(400).json({ message: 'All fields required' });
        const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
        if (!user) return res.status(400).json({ message: 'User not found' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: 'Invalid password' });
        user.lastActive = new Date();
        await user.save();
        if (req.io) req.io.emit('update userlist');
        // Set session user for authentication
        req.session.user = { username: user.username, email: user.email, _id: user._id };
        res.json({ message: 'Login successful', user: { username: user.username, email: user.email, _id: user._id } });
    } catch (err) {
        res.status(500).json({ message: 'Login failed', error: err.message });
    }
};

exports.getUserList = async (req, res) => {
    // Use session user for authentication
    if (!req.session || !req.session.user) return res.status(401).json([]);
    const me = req.session.user.username;
    try {
        const users = await User.find({ username: { $ne: me } }, 'username email');
        const usernames = users.map(u => u.username);
        const lastMsgs = await Chat.aggregate([
            { $match: { $or: [
                { from: me, to: { $in: usernames } },
                { from: { $in: usernames }, to: me }
            ] } },
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: {
                    user: {
                        $cond: [ { $eq: [ "$from", me ] }, "$to", "$from" ]
                    }
                },
                lastMessage: { $first: "$message" },
                lastTime: { $first: "$timestamp" }
            } }
        ]);
        const lastMsgMap = {};
        lastMsgs.forEach(lm => {
            lastMsgMap[lm._id.user] = { lastMessage: lm.lastMessage, lastTime: lm.lastTime };
        });
        const unreadCounts = await Chat.aggregate([
            { $match: { from: { $in: usernames }, to: me, seen: false } },
            { $group: { _id: "$from", count: { $sum: 1 } } }
        ]);
        const unreadMap = {};
        unreadCounts.forEach(u => { unreadMap[u._id] = u.count; });
        const usersWithLastMsg = users.map(user => ({
            username: user.username,
            email: user.email,
            lastMessage: lastMsgMap[user.username]?.lastMessage || '',
            lastTime: lastMsgMap[user.username]?.lastTime || null,
            unreadCount: unreadMap[user.username] || 0
        }));
        usersWithLastMsg.sort((a, b) => {
            if (!a.lastTime && !b.lastTime) return 0;
            if (!a.lastTime) return 1;
            if (!b.lastTime) return -1;
            return new Date(b.lastTime) - new Date(a.lastTime);
        });
        res.json(usersWithLastMsg);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load user list', error: err.message });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
};
