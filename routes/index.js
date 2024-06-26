var express = require('express');
var router = express.Router();
const userModel = require("./users")
const postModel = require("./post")
const storyModel = require("./story")
const commentModel = require("./comment")
const notificationModel = require("./notification")
const videoModel = require("./video")
const passport = require('passport')
const localStrategy = require("passport-local")
const upload = require("./multer")
const fs = require('fs')
const path = require('path');
const utils = require("../utils/utils");
const cloudinary = require('../utils/cloudnary');
const imagekit = require('../utils/imagekit');
const sharp = require('sharp');
const gm = require('gm').subClass({ imageMagick: true });



passport.use(new localStrategy(userModel.authenticate()))

router.get('/', function(req, res) {
  res.render('index', {footer: false});
});

router.get('/login', function(req, res) {
  res.render('login', {footer: false});
});

// router.get('/feed', isloggedin , async function(req, res) {
//   const user = await userModel.findOne({username: req.session.passport.user})
//   const post = await postModel.find().populate("user")
//   const story = await storyModel.find().populate("user")

//   var obj = {};
//   const packs = story.filter(function(story){
//     if(!obj[story.user._id]){
//       obj[story.user._id] = "ascbvjanscm";
//       return true;
//     }
//   })
//   res.render('feed', {footer: true, post,user,story,stories: packs, dater: utils.formatRelativeTime});
// });


router.get("/reel", isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const reels = await videoModel.find().populate('user');

    res.render("reel", { footer: true, reels, user });
  } catch (error) {
    console.error("Error occurred while fetching feed:", error);
    res.status(500).send("Internal Server Error");
  }
});


// router.get("/feed", isloggedin, async function(req, res) {
//   try {
//     const user = await userModel.findOne({ username: req.session.passport.user });

//     if (!user) {
//       return res.status(404).send("User not found");
//     }

//     const posts = await postModel.find().populate('user');

//     const stories = await storyModel.find({ user: { $ne: user._id } }).populate('user');

//     const uniqueStories = {};
//     const filteredStories = stories.filter(story => {
//       if (!uniqueStories[story.user._id]) {
//         uniqueStories[story.user._id] = true;
//         return true;
//       }
//       return false;
//     });

//     res.render("feed", { footer: true, posts, user, stories: filteredStories });
//   } catch (error) {
//     console.error("Error occurred while fetching feed:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// router.get("/feed", isloggedin, async function (req, res) {
//   const user = await userModel.findOne({ username: req.session.passport.user });
//   const posts = await postModel
//   .find()
//   .populate('user')

//   const stories = await storyModel.find({user: {$ne: user._id}})
//   .populate('user');

//   var obj = {};
//   const packs = stories.filter(function(story){
//     if(!obj[story.user._id]){
//       obj[story.user._id] = "ascbvjanscm";
//       return true;
//     }
//   })

//   res.render("feed", { footer: true, posts, user, stories: packs });
// });

router.get("/feed", isloggedin, async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const posts = await postModel.find().populate('user').lean();
    const reels = await videoModel.find().populate('user').lean();
    const stories = await storyModel.find({ user: { $ne: user._id } }).populate('user');

    const uniqueStories = {};
    const filteredStories = stories.filter(story => {
      if (!uniqueStories[story.user._id]) {
        uniqueStories[story.user._id] = true;
        return true;
      }
      return false;
    });

    // Combine and sort posts and reels by creation date
    const combinedPostsAndReels = [...posts, ...reels].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.render("feed", { footer: true, postsAndReels: combinedPostsAndReels, user, stories: filteredStories });
  } catch (error) {
    console.error("Error occurred while fetching feed:", error);
    res.status(500).send("Internal Server Error");
  }
});

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


// router.post('/createcomment', isloggedin, async function(req, res) {
//   const user = await userModel.findOne({username: req.session.passport.user}).populate("posts")
//   const post = await postModel.findOne({_id: req.params.id})
//   console.log(post)
//   const comment = await commentModel.create({
//     comment: req.body.comment,
//     user: user._id,
//     whichpost:params.id,
//   })
//   console.log(comment)
//   post.comments.push(comment._id)
//   await post.save();

//   res.render('back', {footer: true});
// });


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

router.post("/update",upload.single('image'), async function(req,res,next){
  const user = await userModel.findOneAndUpdate({username: req.session.passport.user},{username: req.body.username,name: req.body.name,bio: req.body.bio},{new: true})
  if(req.file){
    const result = await cloudinary.uploader.upload(req.file.path);
    user.profileImage = result.secure_url
  }
  await user.save();

  req.logIn(user,function(err){
    if(err) throw err;
    res.redirect("/profile")
  })

})


router.post("/upload", isloggedin, upload.single("image"), async function(req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No image or video uploaded" });
    }

    const fileType = req.file.mimetype;
    const validImageTypes = ["image/jpeg", "image/png", "image/gif"];
    const validVideoTypes = ["video/mp4", "video/mpeg", "video/ogg"];

    if (!["post", "story", "reel"].includes(req.body.type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    if (req.body.type === "post" || req.body.type === "story") {
      if (!validImageTypes.includes(fileType)) {
        return res.status(400).json({ error: "Invalid file type for post or story. Only images are allowed." });
      }

      const result = await cloudinary.uploader.upload(req.file.path);

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
    } else if (req.body.type === "reel") {
      if (!validVideoTypes.includes(fileType)) {
        return res.status(400).json({ error: "Invalid file type for reel. Only videos are allowed." });
      }

      const videoPath = req.file.path;
      const video = await fs.promises.readFile(videoPath);

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

      await fs.promises.unlink(videoPath);
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

//     console.log(req.body.type)
//     if (!["post", "story","reel"].includes(req.body.type)) {
//       return res.status(400).json({ error: "Invalid type" });
//     }

    
//     if (req.body.type === "post") {
//       const result = await cloudinary.uploader.upload(req.file.path);
//       const post = await postModel.create({
//         picture: result.secure_url,
//         user: user._id,
//         caption: req.body.caption
//       });
//       console.log("New post created:", post);
//       user.posts.push(post._id);
//     } else if (req.body.type === "story") {
//       const result = await cloudinary.uploader.upload(req.file.path);
//       const story = await storyModel.create({
//         picture: result.secure_url,
//         user: user._id
//       });
//       console.log("New story created:", story);
//       user.story.push(story._id);
//     }else if (req.body.type === "reel") {
//       const videoPath = req.file.path;
//   fs.readFile(videoPath, (err, video) => {
//     if (err) {
//       return res.status(500).json({ error: 'Failed to read video file' });
//     }

//     imagekit.upload(
//       {
//         file: video,
//         fileName: req.file.filename,
//         folder: 'videos',
//       },
//       async (error, result) => {
//         if (error) {
//           return res.status(500).json({ error: 'Failed to upload video to ImageKit' });
//         }

//         // Save video metadata to MongoDB
//         const newVideo = new videoModel({
//           description: req.body.description,
//           source: result.url,
//         });

//         try {
//           await newVideo.save();
//           res.status(200).json({ message: 'Video uploaded successfully', video: newVideo });
//         } catch (dbError) {
//           res.status(500).json({ error: 'Failed to save video to database' });
//         }
//       }
//     );
//   });
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
