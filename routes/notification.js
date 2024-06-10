const mongoose = require('mongoose')


const notificationSchema = mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
      },
      content: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'post', 
      },
      message: {
        type: String,
        default: 'like your post',
      },
    date: {
        type: Date,
        default: Date.now,
    },

})

module.exports = mongoose.model("notification",notificationSchema)