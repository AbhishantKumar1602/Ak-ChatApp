const User = require('../models/User');
const Chat = require('../models/Chat');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) 
            return res.status(400)
            .json({ 
                message: 'All fields required' 
            });
        const existing = await User.findOne({ 
            $or: [{ username }, { email }] 
        });
        if (existing) 
            return res.status(400)
            .json({ message: 'Username or email already exists' });
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ 
            username, 
            email, 
            password: hashed 
        });
        await user.save();
        if (req.io) req.io.emit('update userlist');
        res.status(201).json({ message: 'User registered' });
    } catch (err) {
        res.status(500)
            .json({ 
                message: 'Registration failed', 
                error: err.message 
            });
    }
};

exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) 
            return res.status(400)
            .json({ message: 'All fields required' });
        const user = await User.findOne({ 
            $or: [{ 
                username: identifier }, 
                { email: identifier }] 
            });
        if (!user) 
            return res.status(400)
            .json({ message: 'User not found' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) 
            return res.status(400)
            .json({ message: 'Invalid password' });
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

exports.sendFriendRequest = async (req, res) => {
    const from = req.session?.user?.username;
    const { to } = req.body;
    if (!from || !to || from === to) return res.status(400).json({ message: 'Invalid request' });
    try {
        const toUser = await User.findOne({ username: to });
        if (!toUser) return res.status(404).json({ message: 'User not found' });
        // Check if already friends
        if (toUser.contacts.includes(from)) return res.status(400).json({ message: 'Already friends' });
        // Check if already requested
        if (toUser.friendRequests.some(r => r.from === from)) return res.status(400).json({ message: 'Request already sent' });
        toUser.friendRequests.push({ from });
        await toUser.save();
        res.json({ message: 'Friend request sent' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send request', error: err.message });
    }
};

exports.respondFriendRequest = async (req, res) => {
    const to = req.session?.user?.username;
    const { from, accept } = req.body;
    if (!to || !from) return res.status(400).json({ message: 'Invalid request' });
    try {
        const toUser = await User.findOne({ username: to });
        const fromUser = await User.findOne({ username: from });
        if (!toUser || !fromUser) return res.status(404).json({ message: 'User not found' });
        // Remove request
        toUser.friendRequests = toUser.friendRequests.filter(r => r.from !== from);
        if (accept) {
            // Add to contacts for both users
            if (!toUser.contacts.includes(from)) toUser.contacts.push(from);
            if (!fromUser.contacts.includes(to)) fromUser.contacts.push(to);
            await fromUser.save();
        }
        await toUser.save();
        res.json({ message: accept ? 'Friend request accepted' : 'Friend request denied' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to respond to request', error: err.message });
    }
};

// Get pending friend requests for the logged-in user
exports.getFriendRequests = async (req, res) => {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json([]);
    try {
        const user = await User.findOne({ username });
        res.json(user.friendRequests || []);
    } catch (err) {
        res.status(500).json({ message: 'Failed to get requests', error: err.message });
    }
};

// Get contacts for the logged-in user
exports.getContacts = async (req, res) => {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json([]);
    try {
        const user = await User.findOne({ username });
        res.json(user.contacts || []);
    } catch (err) {
        res.status(500).json({ message: 'Failed to get contacts', error: err.message });
    }
};

exports.removeFriend = async (req, res) => {
    const me = req.session?.user?.username;
    const { friend } = req.body;
    if (!me || !friend) return res.status(400).json({ message: 'Missing users' });
    try {
        const meUser = await User.findOne({ username: me });
        const friendUser = await User.findOne({ username: friend });
        if (!meUser || !friendUser) return res.status(404).json({ message: 'User not found' });
        meUser.contacts = meUser.contacts.filter(u => u !== friend);
        friendUser.contacts = friendUser.contacts.filter(u => u !== me);
        await meUser.save();
        await friendUser.save();
        res.json({ message: 'Friend removed' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to remove friend', error: err.message });
    }
};
