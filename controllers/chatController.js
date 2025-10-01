const Chat = require('../models/Chat');
const User = require('../models/User');

exports.getChatHistory = async (req, res) => {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.status(400).json({ message: 'Missing users' });
    try {
        await Chat.updateMany({ from: user2, to: user1, seen: false }, { $set: { seen: true } });
        const history = await Chat.find({
            $or: [
                { from: user1, to: user2 },
                { from: user2, to: user1 }
            ]
        }).sort({ timestamp: 1 }).lean();
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch chat history', error: err.message });
    }
};
