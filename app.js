// Dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require("socket.io");
const multer = require('multer');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const session = require('express-session');

// Route Imports
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const miscRoutes = require('./routes/miscRoutes');
const pageRoutes = require('./routes/pageRoutes');

// Middleware Imports
const authMiddleware = require('./middlewares/auth');

// Model Imports
const User = require('./models/User');
const Chat = require('./models/Chat');

// Configuration
const PORT = 3000;
const MONGODB_URI = 'mongodb+srv://root:1602@akmongo.sya0hez.mongodb.net/akChatApp?retryWrites=true&w=majority&appName=AkMongo';
const __dirnam = path.resolve();

// App Initialization
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8 // 100 MB for large files
});

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirnam, 'views'));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('✅ Connected to MongoDB'));

// ===================================
// FILE UPLOAD CONFIGURATION
// ===================================
const uploadsDir = path.join(__dirnam, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg',
            'video/mp4', 'video/webm', 'video/quicktime',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only images, videos, and documents are allowed.`));
        }
    }
});

// Middleware Configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(express.static(path.join(__dirnam, 'public')));

// Session middleware (add after express.json, before routes)
app.use(session({
    secret: 'your-secret-key', // Change to a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===================================
// FILE UPLOAD ROUTE WITH FFMPEG CONVERSION
// ===================================
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('❌ No file in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let finalFilePath = req.file.path;
        let finalFileName = req.file.filename;
        let finalFileUrl = `/uploads/${req.file.filename}`;
        let finalMimeType = req.file.mimetype;

        console.log('📎 File ready:', {
            filename: finalFileName,
            originalName: req.file.originalname,
            size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
            type: finalMimeType,
            url: finalFileUrl
        });

        res.json({
            success: true,
            fileUrl: finalFileUrl,
            filename: req.file.originalname,
            fileType: finalMimeType,
            fileSize: req.file.size
        });
        
    } catch (error) {
        console.error('❌ File upload error:', error);
        res.status(500).json({ 
            error: 'File upload failed',
            details: error.message 
        });
    }
});

// ===================================
// SOCKET.IO CONFIGURATION
// ===================================
const onlineUsers = {}; // username: Set of socket ids

io.on('connection', (socket) => {
    console.log('🔌 New socket connection:', socket.id);

    // Register user
    socket.on('register user', async (username) => {
        if (!onlineUsers[username]) {
            onlineUsers[username] = new Set();
        }
        onlineUsers[username].add(socket.id);
        socket.username = username;
        console.log(`✅ User registered: ${username} -> ${socket.id}`);
        console.log('📋 Online users:', Object.keys(onlineUsers));
        try {
            await User.updateOne(
                { username }, 
                { $set: { lastActive: new Date() } }
            );
        } catch (error) {
            console.error('❌ Error updating user lastActive:', error);
        }
        io.emit('user-status', { username, online: true });
        io.emit('update userlist');
    });

    // Private message event
    socket.on('private message', async (data) => {
        try {
            const chatMessage = await Chat.create({ 
                from: data.from, 
                to: data.to, 
                message: data.message,
                fileUrl: data.fileUrl || null,
                fileType: data.fileType || null,
                fileName: data.fileName || null,
                status: 'sent',
                timestamp: new Date()
            });

            console.log('💬 Message saved:', {
                from: data.from,
                to: data.to,
                hasFile: !!data.fileUrl,
                fileType: data.fileType
            });

            await User.updateOne(
                { username: data.from }, 
                { $set: { lastActive: new Date() } }
            );

            data.messageId = chatMessage._id.toString();
            
        } catch (e) {
            console.error('❌ Failed to save chat:', e.message);
        }

        const toSocketId = onlineUsers[data.to];
        if (toSocketId) {
            io.to(toSocketId).emit('private message', data);
            console.log(`✅ Message sent to ${data.to}`);
        } else {
            console.log(`⚠️ User ${data.to} is offline`);
        }

        socket.emit('private message', data);

        if (toSocketId) {
            io.to(toSocketId).emit('update userlist');
        }
        if (onlineUsers[data.from]) {
            io.to(onlineUsers[data.from]).emit('update userlist');
        }
    });

    socket.on('mark-as-read', async (data) => {
        try {
            const result = await Chat.updateMany(
                { 
                    from: data.from, 
                    to: data.to, 
                    $or: [
                        { seen: false },
                        { status: { $ne: 'read' } }
                    ]
                },
                { 
                    $set: { 
                        seen: true,
                        status: 'read' 
                    } 
                }
            );
            
            const fromSocketId = onlineUsers[data.from];
            if (fromSocketId) {
                io.to(fromSocketId).emit('messages-read', { user: data.to });
            }
            
            console.log(`✅ Marked ${result.modifiedCount} messages as read: ${data.from} -> ${data.to}`);
        } catch (error) {
            console.error('❌ Mark as read error:', error);
        }
    });

    socket.on('message-reaction', async (data) => {
        try {
            // WhatsApp-style: one reaction per user per message
            const chat = await Chat.findById(data.messageId);
            if (!chat) return;
            // Remove previous reaction by this user
            chat.reactions = chat.reactions.filter(r => r.user !== data.from);
            // Add new reaction
            chat.reactions.push({ user: data.from, emoji: data.reaction });
            await chat.save();
            // Prepare reactions summary for frontend
            const reactionsSummary = {};
            chat.reactions.forEach(r => {
                if (!reactionsSummary[r.emoji]) reactionsSummary[r.emoji] = 0;
                reactionsSummary[r.emoji]++;
            });
            // Broadcast to all users in chat (from/to)
            const allSockets = new Set();
            if (onlineUsers[chat.from]) for (const sid of onlineUsers[chat.from]) allSockets.add(sid);
            if (onlineUsers[chat.to]) for (const sid of onlineUsers[chat.to]) allSockets.add(sid);
            for (const sid of allSockets) {
                io.to(sid).emit('message-reaction', {
                    messageId: chat._id.toString(),
                    reactions: chat.reactions,
                    reactionsSummary
                });
            }
            console.log(`❤️ Reaction: ${data.from} reacted ${data.reaction}`);
        } catch (error) {
            console.error('❌ Reaction error:', error);
        }
    });

    // All call-related socket event handlers removed

    socket.on('typing', (data) => {
        const recipientSocketId = onlineUsers[data.to];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('typing', {
                from: data.from,
                to: data.to,
                typing: data.typing
            });
        }
    });

    socket.on('disconnect', async () => {
        if (socket.username && onlineUsers[socket.username]) {
            onlineUsers[socket.username].delete(socket.id);
            if (onlineUsers[socket.username].size === 0) {
                delete onlineUsers[socket.username];
                console.log(`❌ User disconnected: ${socket.username}`);
                console.log('📋 Online users:', Object.keys(onlineUsers));
                io.emit('user-status', { username: socket.username, online: false });
                try {
                    await User.updateOne(
                        { username: socket.username }, 
                        { $set: { lastActive: new Date() } }
                    );
                } catch (error) {
                    console.error('❌ Error updating user lastActive on disconnect:', error);
                }
            }
            io.emit('update userlist');
        }
    });

    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });
});

// ===================================
// VIEW ROUTES (PUBLIC)
// ===================================
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/login', (req, res) => {
    res.render('login');
});

// Protect /users and /chat pages
app.use(['/users', '/chat'], authMiddleware);

app.use('/', pageRoutes);

// ===================================
// ATTACH SOCKET.IO TO REQUEST
// ===================================
app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

// ===================================
// API ROUTES (PROTECTED)
// ===================================
// Public API routes
app.use('/api', userRoutes); // includes /api/login, /api/register
// Protected API routes
app.use('/api', authMiddleware, chatRoutes);
app.use('/api/unread-counts', authMiddleware, miscRoutes);
app.use('/api/last-active', authMiddleware, miscRoutes);

// ===================================
// HEALTH CHECK ROUTE
// ===================================
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime(),
        onlineUsers: Object.keys(onlineUsers).length,
        memory: process.memoryUsage()
    });
});

// ===================================
// ERROR HANDLING MIDDLEWARE
// ===================================
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File too large. Max 10MB allowed.',
                code: 'FILE_TOO_LARGE' 
            });
        }
        return res.status(400).json({ 
            error: err.message,
            code: err.code 
        });
    }
    
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ 
            error: err.message,
            code: 'INVALID_FILE_TYPE' 
        });
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// ===================================
// 404 HANDLER
// ===================================
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.path 
    });
});

// ===================================
// GRACEFUL SHUTDOWN
// ===================================
process.on('SIGTERM', () => {
    console.log('💤 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
    });
});

// ===================================
// START SERVER
// ===================================
server.listen(PORT, () => {
    console.log('🚀=================================🚀');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🗄️ MongoDB: Connected`);
    console.log(`🎵 FFmpeg: Audio conversion enabled`);
    console.log('🚀=================================🚀');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
