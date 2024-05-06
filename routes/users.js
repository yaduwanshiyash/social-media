require('dotenv').config();
const mongoose = require('mongoose')
const plm = require("passport-local-mongoose")

mongoose.connect(process.env.MONGO_URL).then(() => console.log('Connected!'));

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