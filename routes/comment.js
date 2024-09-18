const mongoose = require('mongoose')


const commentSchema = mongoose.Schema({
    comment: String,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
    },
    whichpost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
    },
    date: {
        type: Date,
        default: Date.now,
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
    }],
})

commentSchema.index({ whichpost: 1, date: -1 })

module.exports = mongoose.model("comment",commentSchema)