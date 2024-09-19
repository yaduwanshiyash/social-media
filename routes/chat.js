const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: String, // 'text', 'image', or 'file'
    fileName: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('chat', messageSchema);
