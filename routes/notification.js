const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['like', 'comment', 'follow', 'mention']
  },
  content: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'contentModel'
  },
  contentModel: {
    type: String,
    required: function() { return this.content != null },
    enum: ['Post', 'Comment','reel']
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true })

notificationSchema.index({ recipient: 1, createdAt: -1 })

module.exports = mongoose.model("Notification", notificationSchema)