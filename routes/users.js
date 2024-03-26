const mongoose = require('mongoose')
const plm = require("passport-local-mongoose")

mongoose.connect("mongodb+srv://yash123:yash12@cluster0.qdqpirv.mongodb.net/instaclone?retryWrites=true&w=majority&appName=Cluster0")

const userSchema = mongoose.Schema({
  username:String,
  name: String,
  email: String,
  password: String,
  profileImage: String,
  bio: String,
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post'
  }],
  story: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'story'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
}],
  followings: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "user",
}],
  bookmarks: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "post",
}]
})
userSchema.plugin(plm)

module.exports = mongoose.model("user",userSchema)