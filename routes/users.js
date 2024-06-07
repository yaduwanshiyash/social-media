require('dotenv').config();
const mongoose = require('mongoose')
const plm = require("passport-local-mongoose")

mongoose.connect(process.env.MONGO_URL).then(() => console.log('Connected!'));

const userSchema = mongoose.Schema({
  username:String,
  name: String,
  email: String,
  password: String,
  profileImage: {
    type: String,
    default: 'https://as1.ftcdn.net/v2/jpg/03/46/83/96/1000_F_346839683_6nAPzbhpSkIpb8pmAwufkC7c5eD7wYws.jpg',
  },
  bio: String,
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post'
  }],
  story: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'story'
  }],
  videos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'video'
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