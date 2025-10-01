const User = require('../models/User');
const Chat = require('../models/Chat');

exports.getUnreadCounts = async (req, res) => {
    const me = req.query.me;
    if (!me) return res.status(400).json({});
    try {
        const users = await User.find({ username: { $ne: me } }, 'username');
        const counts = {};
        await Promise.all(users.map(async user => {
            const unreadCount = await Chat.countDocuments({ from: user.username, to: me, seen: false });
            counts[user.username] = unreadCount;
        }));
        res.json(counts);
    } catch (err) {
        res.status(500).json({ message: 'Failed to get unread counts', error: err.message });
    }
};

exports.getLastActive = async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({});
    try {
        const user = await User.findOne({ username });
        res.json({ lastActive: user ? user.lastActive : null });
    } catch (err) {
        res.status(500).json({ message: 'Failed to get last active', error: err.message });
    }
};
