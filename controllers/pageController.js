const User = require('../models/User');
const Chat = require('../models/Chat');

exports.renderChatPage = async (req, res) => {
    // Use session user for authentication
    if (!req.session || !req.session.user) return res.redirect('/login');
    const me = req.session.user.username;
    const otherUsername = req.query.user;
    if (!otherUsername) return res.status(400).send('Missing user info');
    const otherUser = await User.findOne({ username: otherUsername });
    res.render('chat', {
        me,
        otherUsername,
        otherUserProfile: {
            username: otherUser.username,
            lastActive: otherUser.lastActive
        }
    });
};

exports.renderUserList = async (req, res) => {
    // Use session user for authentication
    if (!req.session || !req.session.user) return res.redirect('/login');
    const me = req.session.user.username;
    const users = await User.find({ username: { $ne: me } }, 'username email');
    const usersWithLastMsg = await Promise.all(users.map(async user => {
        const lastMsg = await Chat.findOne({
            $or: [
                { from: me, to: user.username },
                { from: user.username, to: me }
            ]
        }).sort({ timestamp: -1 });
        const unreadCount = await Chat.countDocuments({ from: user.username, to: me, seen: false });
        return {
            username: user.username,
            email: user.email,
            lastMessage: lastMsg ? lastMsg.message : '',
            lastTime: lastMsg ? lastMsg.timestamp : null,
            unreadCount
        };
    }));
    usersWithLastMsg.sort((a, b) => {
        if (!a.lastTime && !b.lastTime) return 0;
        if (!a.lastTime) return 1;
        if (!b.lastTime) return -1;
        return new Date(b.lastTime) - new Date(a.lastTime);
    });
    res.render('users', { users: usersWithLastMsg, me });
};
