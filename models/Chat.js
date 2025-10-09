const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false },
    fileUrl: { type: String, default: null },
    fileType: { type: String, default: null },
    fileName: { type: String, default: null },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    reactions: [{ user: String, emoji: String, 
        timestamp: { type: Date, default: Date.now } 
    }]
});

// Add indexes for better query performance
chatSchema.index({ from: 1, to: 1, timestamp: -1 });
chatSchema.index({ from: 1, to: 1, seen: 1 });

module.exports = mongoose.model('Chat', chatSchema);
