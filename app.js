const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const expressSession = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const passport = require('passport');
const fs = require('fs'); 
const imagekit = require('./utils/imagekit');
const mime = require('mime-types'); 

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    maxHttpBufferSize: 1e8 // 100 MB
});

// MongoDB schema and model for messages
const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    content: String,
    type: String, // 'text', 'image', or 'file'
    fileName: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// In-memory store for online users
const onlineUsers = {};
const users = {}; // To keep track of user connection and typing status
let messages = []; // Store messages

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}


// Socket.io logic
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('joinRoom', ({ userId, roomName }) => {
        socket.join(roomName);
        onlineUsers[userId] = socket.id;
        console.log(`User ${userId} joined room ${roomName}`);
        io.to(roomName).emit('userOnline', { userId });
    });
    // When a user comes online
    socket.on('userConnected', (userId) => {
        socket.join(userId);  // This allows targeting messages to specific users
        onlineUsers[userId] = socket.id; // Track the user's socket ID
        io.emit('userOnline', { userId }); // Notify all clients that the user is online
        console.log(`${userId} is online`);
    });

 


    socket.on('userTyping', ({ userId, roomName, typing }) => {
        socket.to(roomName).emit('typing', { userId, typing });
    });

    socket.on('markAsRead', data => {
        const { userId, messageId } = data;
        const message = messages.find(msg => msg.id === messageId);
        if (message) {
            if (!message.read[userId]) {
                message.read[userId] = true;
                io.emit('messageRead', { userId, messageId });
            }
        }
    });

    // Handle sending new messages
    socket.on('sendMessage', async (messageData) => {
        
        if (messageData.type === 'image' || messageData.type === 'video' || messageData.type === 'file') {
            const base64Data = messageData.content.split(';base64,').pop();
            const fileExtension = mime.extension(messageData.fileType);
            const fileName = `${Date.now()}.${fileExtension}`;

            imagekit.upload({
                file: base64Data,
                fileName: fileName,
                folder: "/chat_uploads/",
                useUniqueFileName: true,
                tags: [messageData.type]
            }, async function(error, result) {
                if(error) {
                    console.error('Error uploading to ImageKit:', error);
                    return;
                }

                messageData.content = result.url;
                messageData.fileName = result.name;
                
                const newMessage = new Message(messageData);
                await newMessage.save();
                
                io.to(messageData.roomName).emit('receiveMessage', messageData);
            });
        } else {
            const newMessage = new Message(messageData);
            await newMessage.save();
            io.to(messageData.roomName).emit('receiveMessage', messageData);
        }
    });

    // Handle fetching chat messages between two users
    socket.on('fetchMessages', async ({ sender, receiver, roomName }) => {
        const messages = await Message.find({
            $or: [
                { sender, receiver },
                { sender: receiver, receiver: sender }
            ]
        }).sort({ timestamp: 1 });

        socket.emit('loadMessages', messages);
    });

    // Handle video call request from a user
    socket.on('callUser', (receiverId) => {
        const receiverSocketId = onlineUsers[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('callUser', { callerId: socket.id });
        }
    });

    // Handle call acceptance from a user
    socket.on('acceptCall', (callerId) => {
        io.to(callerId).emit('callAccepted', { receiverId: socket.id });
    });

    // Handle signaling messages (offer, answer, and ICE candidates)
    socket.on('offer', (data) => {
        io.to(data.receiver).emit('offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('answer', (data) => {
        io.to(data.receiver).emit('answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('ice-candidate', (data) => {
        io.to(data.receiver).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
    });

    // End call
    socket.on('end-call', (receiverId) => {
        io.to(receiverId).emit('end-call');
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        const userId = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
        if (userId) {
            delete onlineUsers[userId];
            io.emit('userOffline', { userId });
            console.log(`${userId} is offline`);
        }
    });
});

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(
    expressSession({
        resave: false,
        saveUninitialized: false,
        secret: 'yourSecret',
        rolling: true,
  cookie: { 
    secure: false,
    maxAge: 2 * 60 * 60 * 1000 // 2 hours in milliseconds
  }
    })
);
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(usersRouter.serializeUser());
passport.deserializeUser(usersRouter.deserializeUser());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);
    res.render('error');
});

// Start the server
server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});

module.exports = app;
