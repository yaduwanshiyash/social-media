const mongoose = require('mongoose')


const postSchema = mongoose.Schema({
    picture: String,
    caption: String,
    user: {
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
    bookmark: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "comment",
    }],
})

module.exports = mongoose.model("post",postSchema)