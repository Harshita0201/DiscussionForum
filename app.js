require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb://localhost:27017/ForumDB", {useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

const ForumSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  forumTopic:String,
  forumBody:String
});

ForumSchema.plugin(passportLocalMongoose);
ForumSchema.plugin(findOrCreate);

const Forum = new mongoose.model("Forum", ForumSchema);

passport.use(Forum.createStrategy());

passport.serializeUser(Forum.serializeUser());
passport.deserializeUser(Forum.deserializeUser());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  Forum.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/DisscussionForum",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    Forum.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/DisscussionForum",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to DisscussionForum.
    res.redirect("/DisscussionForum");
  });

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/DisscussionForum", function(req, res){

  //finds all posts and if no error renders them on home route
  Forum.find({}, function(err, forums){
    res.render("DisscussionForum", {
      forums: forums
      });
  });

});

app.get("/compose",function(req,res){
  if (req.isAuthenticated()){
    res.render("compose");
  } else {
    res.redirect("/login");
  }
});

app.get("/contribute",function(req,res){
  if (req.isAuthenticated()){
    res.render("contribute");
  } else {
    res.redirect("/register");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/compose",function(req, res){
  const submittedTopic = req.body.forumTopic;
  const submittedBody = req.body.forumBody;

//Once the user is authenticated and their session gets saved, their user details are saved to req.user.
console.log(req.user.id);

Forum.findById(req.user.id, function(err, foundUser){
  if (err) {
    console.log(err);
  } else {
    if (foundUser) {
      foundUser.forumTopic = submittedTopic;
      foundUser.forumBody = submittedBody;
      foundUser.save(function(){
        res.redirect("/DisscussionForum");
      });
    }
  }
});
});

app.post("/contribute", function(req,res){
  // const submittedTopic = req.body.forumcomment;
  console.log(req.user.id);
});

app.post("/register", function(req, res){
  Forum.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/DisscussionForum");
      });
    }
  });
});

app.post("/login", function(req, res){
  const user = new Forum({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/DisscussionForum");
      });
    }
  });
});

app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
