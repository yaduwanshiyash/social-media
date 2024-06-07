const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  caption: {
    type: String,
  },
  duration: {
    type: Number,
  },
  source: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
}],
comments: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "comment",
}],
  tags: {
    type: [String],
  },
  publishedAt: {
    type: Date,
    default: Date.now,
  },
});

const Video = mongoose.model("Video", videoSchema);

module.exports = Video;
