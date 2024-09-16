var express = require('express');
var router = express.Router();
const userModel = require("./users")
const postModel = require("./post")
const mongoose = require('mongoose')
const Message = require('./chat');
const storyModel = require("./story")
const commentModel = require("./comment")
const notificationModel = require("./notification")
const videoModel = require("./video")
const passport = require('passport')
const localStrategy = require("passport-local")
const upload = require("./multer")
const utils = require("../utils/utils");
const cloudinary = require('../utils/cloudnary');
const imagekit = require('../utils/imagekit');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const gm = require('gm').subClass({ imageMagick: true });
const redisClient = require('../utils/redis');




passport.use(new localStrategy(userModel.authenticate()))

router.get('/', function(req, res) {
  res.render('index', {footer: false});
});

router.get('/login', function(req, res) {
  res.render('login', {footer: false});
});

router.get('/chat', isloggedin, async function(req, res) {
  try {
      const user = await userModel.findOne({ username: req.session.passport.user }).populate('followings').exec();
      if (!user) {
          return res.status(404).send('User not found');
      }
      res.render('friends', { footer: true, user, friends: user.followings });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
  }
});

// GET chat history with a specific friend



router.get('/chat/:friendId', isloggedin, async (req, res) => {
    try {
        const { friendId } = req.params;
        const user = await userModel.findOne({ username: req.session.passport.user }).populate('followings').exec();

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Convert to ObjectId using mongoose.Types.ObjectId()
        // const userId = mongoose.Types.ObjectId(user._id);
        // const friendObjectId = mongoose.Types.ObjectId(friendId);

        const messages = await Message.find({
            $or: [
                { sender: user, receiver: friendId },
                { sender: friendId, receiver: user }
            ]
        }).sort({ timestamp: 1 });

        const friend = await userModel.findById(friendId);
        if (!friend) {
            return res.status(404).send('Friend not found');
        }

        res.render('chat', { friend, friends: user.followings, messages, user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// Example route: /reel
router.get('/reel', isloggedin, async (req, res) => {
  try {
    // Get the logged-in user
    const user = await userModel.findOne({ username: req.session.passport.user });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Cache key to store and retrieve data
    const cacheKey = `reels:${user._id}`;

    // Try to get data from Redis
    const cachedReels = await redisClient.get(cacheKey);

    if (cachedReels) {
      // If cached data is found, parse it and send it to the client
      console.log('Cache hit');
      const reels = JSON.parse(cachedReels);
      return res.render('reel', { footer: false, reels, user });
    } else {
      // If no cache, fetch from MongoDB
      const reels = await videoModel.find().populate('user').lean();

      // Store fetched data in Redis for 60 seconds
      await redisClient.setEx(cacheKey, 600, JSON.stringify(reels));

      // Send the response to the client
      res.render('reel', { footer: false, reels, user });
    }
  } catch (error) {
    console.error('Error occurred while fetching reels:', error);
    res.status(500).send('Internal Server Error');
  }
});

// router.get("/reel", isloggedin, async function(req, res) {
//   try {
//     const user = await userModel.findOne({ username: req.session.passport.user });

//     if (!user) {
//       return res.status(404).send("User not found");
//     }

//     const reels = await videoModel.find().populate('user');

//     res.render("reel", { footer: true, reels, user });
//   } catch (error) {
//     console.error("Error occurred while fetching feed:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });



// old code

router.get("/feed", isloggedin, async function (req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    if (!user) return res.status(404).send("User not found");

    const cacheKey = `feed:${user._id}`;
    const limit = 10; // Items per page
    const page = req.query.page || 1;
    const skip = (page - 1) * limit;

    // Try to get data from Redis
    let cachedfeed;
    try {
      cachedfeed = await redisClient.get(cacheKey);
    } catch (redisError) {
      console.error("Redis error:", redisError);
    }

    let stories;
    if (cachedfeed) {
      // If cached data is found, parse it and send it to the client
      const combinedPostsAndReels = JSON.parse(cachedfeed);

      // Fetch stories (since they are not cached)
      stories = await storyModel
        .find({ user: { $ne: user._id } })
        .populate("user", "username profileImage")
        .lean();

      const uniqueStories = new Set();
      const filteredStories = stories.filter((story) => {
        if (!uniqueStories.has(story.user._id)) {
          uniqueStories.add(story.user._id);
          return true;
        }
        return false;
      });

      return res.render("feed", {
        footer: true,
        postsAndReels: combinedPostsAndReels,
        user,
        stories: filteredStories,
      });
    } else {
      // If no cache, fetch from MongoDB
      const [posts, reels] = await Promise.all([
        postModel
          .find()
          .populate("user", "username profileImage")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        videoModel
          .find()
          .populate("user", "username profileImage")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      stories = await storyModel
        .find({ user: { $ne: user._id } })
        .populate("user", "username profileImage")
        .lean();

      const uniqueStories = new Set();
      const filteredStories = stories.filter((story) => {
        if (!uniqueStories.has(story.user._id)) {
          uniqueStories.add(story.user._id);
          return true;
        }
        return false;
      });

      const combinedPostsAndReels = [...posts, ...reels].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Store fetched data in Redis for 10 minutes
      try {
        await redisClient.setEx(cacheKey, 600, JSON.stringify(combinedPostsAndReels));
      } catch (redisError) {
        console.error("Redis error:", redisError);
      }

      // Send the response to the client
      return res.render("feed", {
        footer: true,
        postsAndReels: combinedPostsAndReels,
        user,
        stories: filteredStories,
      });
    }
  } catch (error) {
    console.error("Error occurred while fetching feed:", error);
    return res.status(500).send("Internal Server Error");
  }
});



// router.get("/feed", isloggedin, async function(req, res) {
//   try {
//     const user = await userModel.findOne({ username: req.session.passport.user });

//     if (!user) {
//       return res.status(404).send("User not found");
//     }

//     const posts = await postModel.find().populate('user').lean();
//     const reels = await videoModel.find().populate('user').lean();
//     const stories = await storyModel.find({ user: { $ne: user._id } }).populate('user');

//     const uniqueStories = {};
//     const filteredStories = stories.filter(story => {
//       if (!uniqueStories[story.user._id]) {
//         uniqueStories[story.user._id] = true;
//         return true;
//       }
//       return false;
//     });

//     // Combine and sort posts and reels by creation date
//     const combinedPostsAndReels = [...posts, ...reels].sort((a, b) => {
//       return new Date(b.createdAt) - new Date(a.createdAt);
//     });

//     res.render("feed", { footer: true, postsAndReels: combinedPostsAndReels, user, stories: filteredStories });
//   } catch (error) {
//     console.error("Error occurred while fetching feed:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

router.get("/story/:number", isloggedin, async function (req, res) {
  try {
    const storyuser = await userModel.findOne({ username: req.session.passport.user }).populate("story");

    if (!storyuser || !storyuser.story || storyuser.story.length === 0) {
      return res.redirect("/feed")
    }

    const storyNumber = parseInt(req.params.number);
    if (isNaN(storyNumber) || storyNumber < 0 || storyNumber >= storyuser.story.length) {
      return res.redirect("/feed"); 
    }

    const image = storyuser.story[storyNumber];
    res.render("story", { footer: false, storyuser, storyimage: image, number: storyNumber });
  } catch (error) {
    console.error("Error occurred while fetching story:", error);
    res.status(500).send("Internal Server Error");
  }
});

// router.get("/story/:number", isloggedin, async function (req, res) {
//   const storyuser = await userModel.findOne({ username: req.session.passport.user })
//   .populate("story")

//   const image = storyuser.story[req.params.number];

//   if(storyuser.story.length > req.params.number){
//     res.render("story", { footer: false, storyuser: storyuser, storyimage : image, number: req.params.number });
//   }
//   else{
//     res.redirect("/feed");
//   }
// });

router.get("/story/:id/:number", isloggedin, async function (req, res) {
  try {
    const storyuser = await userModel.findOne({ _id: req.params.id }).populate("story");

    if (!storyuser || !storyuser.story || storyuser.story.length === 0) {
      return res.redirect("/feed"); 
    }

    const storyNumber = parseInt(req.params.number);
    if (isNaN(storyNumber) || storyNumber < 0 || storyNumber >= storyuser.story.length) {
      return res.redirect("/feed"); 
    }

    const image = storyuser.story[storyNumber];
    res.render("story", { footer: false, storyuser, storyimage: image, number: storyNumber });
  } catch (error) {
    console.error("Error occurred while fetching story:", error);
    res.status(500).send("Internal Server Error");
  }
});


// router.get("/story/:id/:number", isloggedin, async function (req, res) {
//   const storyuser = await userModel.findOne({ _id: req.params.id })
//   .populate("story")

//   const image = storyuser.story[req.params.number];

//   if(storyuser.story.length > req.params.number){
//     res.render("story", { footer: false, storyuser: storyuser, storyimage : image, number: req.params.number });
//   }
//   else{
//     res.redirect("/feed");
//   }

// });


// router.get('/story/view/:id', isloggedin, async function(req, res) {
//   const user = await userModel.findOne({username: req.session.passport.user})
//   const story = await storyModel.findOne({_id: req.params.id}).populate('user')
//   res.render('story', {footer: true,user,story});
// });

router.get('/userprofile/:username', isloggedin, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user})
  const other = await userModel.findOne({username: req.params.username}).populate('posts')
  if(other.username == user.username){
    res.redirect('/profile');
  }else{
    res.render('userprofile', {footer: true,user,other});
  }
});

router.get('/comment/reel/:id', isloggedin, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user})
  const post = await videoModel.findOne({ _id: req.params.id }).populate([
    {
      path: 'comments',
      populate: { path: 'user' } // Populate the 'user' field of each comment
    },
    {
      path: 'user' // Populate the 'user' field of the post
    }
  ]);

  res.render('comment', {footer: true, user, post});
});
router.get('/comment/:id', isloggedin, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user})
  const post = await postModel.findOne({ _id: req.params.id }).populate([
    {
      path: 'comments',
      populate: { path: 'user' } // Populate the 'user' field of each comment
    },
    {
      path: 'user' // Populate the 'user' field of the post
    }
  ]);

  res.render('comment', {footer: true, user, post});
});

router.post('/createcomment/:id', isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user }).populate("posts");
    const post = await postModel.findOne({ _id: req.params.id });


    const comment = await commentModel.create({
      comment: req.body.comment,
      user: user._id,
      whichpost: req.params.id,
    });


    post.comments.push(comment._id);
    await post.save();

    res.redirect('back');
  } catch (error) {
    // Handle any errors
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});




router.get('/profilenew', isloggedin, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user}).populate("posts")
  const posts = await postModel.find()

  res.render('profilenew', {footer: true, user,posts});
});
router.get('/profile', isloggedin, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user}).populate("posts")

  res.render('profile', {footer: true, user});
});



router.get('/search', isloggedin ,async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user})
  res.render('search', {footer: true,user});
});

router.get('/username/:username', async function(req, res) {
    const regex = new RegExp(`^${req.params.username}`,'i')
    const users = await userModel.find({username: regex})
    res.json(users);
});

router.get('/edit', isloggedin, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user})
  res.render('edit', {footer: true, user});
});

router.get('/upload', isloggedin ,async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user})
  res.render('upload', {footer: true,user});
});

router.post("/register",function(req,res,next){
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    email: req.body.email,
  })

  userModel.register(userData, req.body.password)
  .then(function(){
    passport.authenticate("local")(req,res,function(){
      res.redirect("/profile")
    })
  })
})

router.post("/login",passport.authenticate("local",{
  successRedirect: "/profile",
  failureRedirect: "/login"
}),function(req,res){

})

router.get('/logout', function(req, res, next){
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// router.post("/update",upload.single('image'), async function(req,res,next){
//   const user = await userModel.findOneAndUpdate({username: req.session.passport.user},{username: req.body.username,name: req.body.name,bio: req.body.bio},{new: true})
//   if(req.file){
//     const result = await cloudinary.uploader.upload(req.file.path);
//     user.profileImage = result.secure_url
//   }
//   await user.save();

//   req.logIn(user,function(err){
//     if(err) throw err;
//     res.redirect("/profile")
//   })

// })


router.post("/update", upload.single('image'), async function(req, res, next) {
  try {
    // Find and update the user information
    const user = await userModel.findOneAndUpdate(
      { username: req.session.passport.user },
      { username: req.body.username, name: req.body.name, bio: req.body.bio },
      { new: true }
    );

    if (req.file) {
      // Define the path for the compressed and converted WebP image
      const compressedImagePath = path.join(uploadsDir, `compressed_${req.file.filename}.webp`);

      // Compress and convert the image to WebP format using sharp
      await sharp(req.file.path)
        .resize({ width: 500 })  // Resize the image to 1080px width
        .webp({ quality: 50 })    // Compress and convert to WebP format with 85% quality
        .toFile(compressedImagePath);  // Save the WebP image

      // Upload the compressed WebP image to Cloudinary
      const result = await cloudinary.uploader.upload(compressedImagePath);

      // Set the profile image URL to the uploaded image's secure URL
      user.profileImage = result.secure_url;

      // Remove the compressed WebP file from the server after upload
      await fs.promises.unlink(compressedImagePath);
    }

    // Save the updated user information
    await user.save();

    // Re-login the user and redirect to the profile page
    req.logIn(user, function(err) {
      if (err) throw err;
      res.redirect("/profile");
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    next(error);  // Pass the error to the error handler
  }
});

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

router.post("/upload", isloggedin, upload.single("image"), async function (req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No image or video uploaded" });
    }

    const fileType = req.file.mimetype;
    const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const validVideoTypes = ["video/mp4", "video/mpeg", "video/ogg"];

    if (!["post", "story", "reel"].includes(req.body.type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    // Handle post or story (image compression)
    if (req.body.type === "post" || req.body.type === "story") {
      if (!validImageTypes.includes(fileType)) {
        return res.status(400).json({ error: "Invalid file type for post or story. Only images are allowed." });
      }

      // Compress and resize image using sharp
      const compressedImagePath = path.join(uploadsDir, `compressed_${req.file.filename}.webp`);
      await sharp(req.file.path)
        .resize({ width: 1080 })  // Resize image to 1080px width
        .webp({ quality: 85 })  // Compress to 85% quality and convert to webp format
        .toFile(compressedImagePath);  // Save to the uploads directory

      // Upload the compressed image to cloudinary
      const result = await cloudinary.uploader.upload(compressedImagePath);

      if (req.body.type === "post") {
        const post = await postModel.create({
          picture: result.secure_url,
          user: user._id,
          caption: req.body.caption
        });
        console.log("New post created:", post);
        user.posts.push(post._id);
      } else if (req.body.type === "story") {
        const story = await storyModel.create({
          picture: result.secure_url,
          user: user._id
        });
        console.log("New story created:", story);
        user.stories.push(story._id);
      }

      // Remove the compressed file after upload
      await fs.promises.unlink(compressedImagePath);
    }

    // Handle reel (video compression)
    else if (req.body.type === "reel") {
      if (!validVideoTypes.includes(fileType)) {
        return res.status(400).json({ error: "Invalid file type for reel. Only videos are allowed." });
      }

      const compressedVideoPath = path.join(uploadsDir, `compressed_${req.file.filename}`);

      // Compress video using fluent-ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(req.file.path)
          .output(compressedVideoPath)
          .size('720x?')  // Resize video to 720px width (HD)
          .videoBitrate('1000k')  // Set video bitrate to 1000k (1Mbps)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Upload compressed video to ImageKit or Cloudinary
      const video = await fs.promises.readFile(compressedVideoPath);
      const result = await new Promise((resolve, reject) => {
        imagekit.upload(
          {
            file: video,
            fileName: req.file.filename,
            folder: 'videos',
          },
          (error, result) => {
            if (error) {
              reject(new Error('Failed to upload video to ImageKit'));
            } else {
              resolve(result);
            }
          }
        );
      });

      const newVideo = new videoModel({
        caption: req.body.caption,
        source: result.url,
        user: user._id
      });

      await newVideo.save();
      user.videos.push(newVideo._id);
      console.log("New reel created:", newVideo);

      // Remove original and compressed files after upload
      await fs.promises.unlink(req.file.path);
      await fs.promises.unlink(compressedVideoPath);
    }

    await user.save();
    res.redirect("/feed");
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// router.post("/upload", isloggedin, upload.single("image"), async function(req, res) {
//   try {
//     const user = await userModel.findOne({ username: req.session.passport.user });

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     if (!req.file) {
//       return res.status(400).json({ error: "No image or video uploaded" });
//     }

//     const fileType = req.file.mimetype;
//     const validImageTypes = ["image/jpeg", "image/png", "image/gif"];
//     const validVideoTypes = ["video/mp4", "video/mpeg", "video/ogg"];

//     if (!["post", "story", "reel"].includes(req.body.type)) {
//       return res.status(400).json({ error: "Invalid type" });
//     }

//     if (req.body.type === "post" || req.body.type === "story") {
//       if (!validImageTypes.includes(fileType)) {
//         return res.status(400).json({ error: "Invalid file type for post or story. Only images are allowed." });
//       }

//       const result = await cloudinary.uploader.upload(req.file.path);

//       if (req.body.type === "post") {
//         const post = await postModel.create({
//           picture: result.secure_url,
//           user: user._id,
//           caption: req.body.caption
//         });
//         console.log("New post created:", post);
//         user.posts.push(post._id);
//       } else if (req.body.type === "story") {
//         const story = await storyModel.create({
//           picture: result.secure_url,
//           user: user._id
//         });
//         console.log("New story created:", story);
//         user.stories.push(story._id);
//       }
//     } else if (req.body.type === "reel") {
//       if (!validVideoTypes.includes(fileType)) {
//         return res.status(400).json({ error: "Invalid file type for reel. Only videos are allowed." });
//       }

//       const videoPath = req.file.path;
//       const video = await fs.promises.readFile(videoPath);

//       const result = await new Promise((resolve, reject) => {
//         imagekit.upload(
//           {
//             file: video,
//             fileName: req.file.filename,
//             folder: 'videos',
//           },
//           (error, result) => {
//             if (error) {
//               reject(new Error('Failed to upload video to ImageKit'));
//             } else {
//               resolve(result);
//             }
//           }
//         );
//       });

//       const newVideo = new videoModel({
//         caption: req.body.caption,
//         source: result.url,
//         user: user._id
//       });

//       await newVideo.save();
//       user.videos.push(newVideo._id);
//       console.log("New reel created:", newVideo);

//       await fs.promises.unlink(videoPath);
//     }

//     await user.save();
//     res.redirect("/feed");
//   } catch (error) {
//     console.error("Error occurred:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });



router.get("/like/story/:id", isloggedin, async function(req,res){
  const user = await userModel.findOne({ username: req.session.passport.user})
  const story = await storyModel.findOne({_id: req.params.id})

  if(story.likes.indexOf(user._id) == -1){
    story.likes.push(user._id)
  }
  else{
    story.likes.splice(story.likes.indexOf(user._id), 1)
  }

  await story.save();
})
router.get("/like/reel/:id", isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    const reel = await videoModel.findOne({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!reel) {
      return res.status(404).json({ error: "Reel not found" });
    }

    const userIndex = reel.likes.indexOf(user._id);

    if (userIndex === -1) {
      reel.likes.push(user._id);
    } else {
      reel.likes.splice(userIndex, 1);
    }

    await reel.save();
    res.json(reel);
  } catch (error) {
    console.error("Error occurred while liking reel:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get("/like/post/:id", isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const post = await postModel.findOne({ _id: req.params.id });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const userIndex = post.likes.indexOf(user._id);

    if (userIndex === -1) {
      post.likes.push(user._id);
    } else {
      post.likes.splice(userIndex, 1);
    }

    if (user._id.toString() !== post.user._id.toString()) {
      const notification = await notificationModel.create({
        sender: user._id,
        content: req.params.id,
        recipient: post.user._id
      });

      console.log("Notification created:", notification);

      user.notifications.push(notification._id);
      await user.save();
    }

    await post.save();
    res.json(post);
  } catch (error) {
    console.error("Error occurred while liking post:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



router.get("/like/comment/:id", isloggedin, async function(req,res){
  const user = await userModel.findOne({ username: req.session.passport.user})
  const comment = await commentModel.findOne({_id: req.params.id})

  if(comment.likes.indexOf(user._id) == -1){
    comment.likes.push(user._id)
  }
  else{
    comment.likes.splice(comment.likes.indexOf(user._id), 1)
  }

  await comment.save();
  res.redirect('back')
})

router.get("/delete/post/:id", isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    const post = await postModel.findOne({ _id: req.params.id });

    if (!user || !post) {
      return res.status(404).send("User or post not found");
    }

    // Remove post reference from user's posts array
    const postIndex = user.posts.indexOf(post._id);
    if (postIndex !== -1) {
      user.posts.splice(postIndex, 1);
    }

    // Save user changes
    await user.save();

    // Delete associated image from the 'uploads' directory
    if (post.picture) {
      const uploadPath = path.resolve(__dirname, '../public/images/uploads');
      const imagePath = path.join(uploadPath, post.picture);

      console.log('Image Path:', imagePath);

      try {
        await fs.unlink(imagePath);
        console.log(`Successfully deleted image: ${post.picture}`);
      } catch (error) {
        console.error(`Error deleting image: ${post.picture}`, error);
      }
    }

    // Remove post document
    await postModel.deleteOne({ _id: req.params.id });

    res.redirect("back");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/follow/:username", isloggedin, async function(req,res){
  const user = await userModel.findOne({ username: req.session.passport.user})
  const another = await userModel.findOne({username: req.params.username})

  if(another.followers.indexOf(user._id) == -1){
    another.followers.push(user._id)
  }
  else{
    another.followers.splice(another.followers.indexOf(user._id), 1)
  }
  if(user.followings.indexOf(another._id) == -1){
    user.followings.push(another._id)
  }
  else{
    user.followings.splice(user.followings.indexOf(user._id), 1)
  }
  

  await another.save();
  await user.save();
 
  res.redirect("back");
})
router.get("/bookmark/:id", isloggedin, async function(req,res){
  const user = await userModel.findOne({ username: req.session.passport.user})
  const newpost = await postModel.findOne({_id: req.params.id})

  if(newpost.bookmark.indexOf(user._id) == -1){
    newpost.bookmark.push(user._id)
  }
  else{
    newpost.bookmark.splice(newpost.bookmark.indexOf(user._id), 1)
  }
  if(user.bookmarks.indexOf(newpost._id) == -1){
    user.bookmarks.push(newpost._id)
  }
  else{
    user.bookmarks.splice(user.bookmarks.indexOf(newpost._id), 1)
  }
  

  await newpost.save();
  await user.save();
 
  res.json(newpost);
})

router.get('/notification', isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user })
    .populate({
      path: 'notifications',
      populate: [
        { path: 'sender' },
        { path: 'content' }
      ]
    });

    console.log(user);
    res.render('notify', { footer: true, user });
  } catch (error) {
    console.error("Error occurred while populating notifications:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get('/followers/:username', isloggedin, async function(req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user})
  const another = await userModel.findOne({username: req.params.username}).populate("followers")
  res.render('followers', {footer: true, user, another});
});

router.get('/liked/post/:id', isloggedin, async function(req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user})
  const liked = await postModel.findOne({_id: req.params.id}).populate("likes")
  res.render('liked', {footer: true, user,liked});
});
router.get('/liked/reel/:id', isloggedin, async function(req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user})
  const liked = await videoModel.findOne({_id: req.params.id}).populate("likes")
  res.render('liked', {footer: true, user,liked});
});
router.get('/following/:username', isloggedin, async function(req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user})
  const another = await userModel.findOne({username: req.params.username}).populate("followings")
  console.log(another)
  res.render('following', {footer: true, user, another});
});

function isloggedin(req,res,next){
  if(req.isAuthenticated()) return next();
  res.redirect("/login")
}

module.exports = router;
