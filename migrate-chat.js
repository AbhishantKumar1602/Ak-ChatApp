const mongoose = require('mongoose');
const Chat = require('./models/Chat');

const MONGODB_URI = 'mongodb+srv://root:1602@akmongo.sya0hez.mongodb.net/akChatApp?retryWrites=true&w=majority&appName=AkMongo';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function migrate() {
    try {
        console.log('🔄 Starting migration...');
        
        // Add default values to existing documents
        const result = await Chat.updateMany(
            { 
                $or: [
                    { fileUrl: { $exists: false } },
                    { status: { $exists: false } },
                    { reactions: { $exists: false } }
                ]
            },
            { 
                $set: { 
                    fileUrl: null,
                    fileType: null,
                    fileName: null,
                    reactions: []
                },
                $setOnInsert: {
                    status: 'sent'
                }
            }
        );
        
        // Update status based on seen field
        await Chat.updateMany(
            { seen: true, status: { $ne: 'read' } },
            { $set: { status: 'read' } }
        );
        
        console.log(`✅ Migration complete! Updated ${result.modifiedCount} documents`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

migrate();
