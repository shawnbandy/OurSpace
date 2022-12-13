const { Message, Post, GraffitiPost, User } = require('../models');
const { AuthenticationError } = require('apollo-server-express');
const { signToken } = require('../utils/auth');

const resolvers = {
  //TODO User
  //*user: find your user, populate all the posts from you
  //*post: find your user, get your friends, populate all their posts/comments on your home page
  Query: {
    //*user will get all of the user's friends, which will hold all of their data. Only need the posts from it
    //TODO find each friend's post
    allUser: async () => {
      return User.find({});
    },
    user: async (parent, { userId }) => {
      return User.findOne({ _id: userId }).populate('friends');
    },
    //*gets all of the user's posts/comments
    userPost: async (parent, { postId }) => {
      return Post.findOne({ _id: postId });
    },
    //*gets all of the user's graffiti
    userGraffitiPost: async (parent, { userId }) => {
      return User.findOne({ _id: userId }).populate('graffitiPosts');
    },
    //*returns all the messages the user is a part of
    userMessage: async (parent, { userId }) => {
      return User.findOne({ _id: userId }).populate('messages');
    },
    userPendingFriend: async (parent, { userId }) => {
      return User.findOne({ _id: userId }).populate('pendingFriends');
    },

    userHomePage: async (parent, { userId }) => {
      const user = await User.findOne({ userId }).populate('friends');
      const postArr = [];
      return user;
    },

    //*gets the logged in user's posts
    me: async (parent, args, context) => {
      if (context.user) {
        return User.findOne({ _id: context.user._id }).populate('posts');
      }
      throw new AuthenticationError('You need to be logged in!');
    },
  },

  //TODO: DELETE: User, post, comment, graffiti, friend, pending friend, MessageThread
  //TODO: EDIT: User
  //!: Remove from above list AFTER you do the typeDefs!!
  Mutation: {
    addUser: async (parent, { firstName, lastName, email, password }) => {
      const user = await User.create({ firstName, lastName, email, password });
      const token = signToken(user);
      return { token, user };
    },

    deleteUser: async (parent, args, context) => {
      if (context.user) {
        const user = await User.findByIdAndDelete({ _id: context.user._id });
        return user;
      }
    },

    updateUser: async (parent, { firstName, lastName, email, password }) => {
      if (context.user) {
        const updatedUser = await User.findByIdAndUpdate(
          { _id: context.user._id },
          { firstName: firstName },
          { lastName: lastName },
          { email: email },
          { password: { password } }
        );
      }
    },

    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw new AuthenticationError('Email address not found');
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw new AuthenticationError('Incorrect email/password');
      }

      const token = signToken(user);

      return { token, user };
    },
    addPost: async (parent, { postText }, context) => {
      if (context.user) {
        const newPost = await Post.create({
          postText: postText,
        });

        await User.findOneAndUpdate(
          { _id: context.user._id },
          { $addToSet: { posts: newPost._id } },
          { new: true }
        );

        return newPost;
      }
    },

    //*finds a post and updates it with the comment by adding it to the array
    addComment: async (parent, { postId, commentText }, context) => {
      if (context.user) {
        const post = await Post.findOneAndUpdate(
          { _id: postId },
          {
            $addToSet: {
              comments: {
                commentText: commentText,
                commentAuthor: context.user._id,
              },
            },
          },
          { new: true }
        );

        return post;
      }
    },

    //*adds a user to another user's pending friend list
    //?later, we can just check to see if the context.user.id is on any other pending lists to populate those
    sendPendingFriend: async (parent, { receiverId }, context) => {
      //*context user is the sender of the request
      if (context.user && receiverId) {
        const user = User.findOneAndUpdate(
          { _id: receiverId },
          { $addToSet: { pendingFriends: context.user._id } },
          { new: true }
        );
        return user;
      }
    },

    //*accept a friend= add them to the friend array, remove them from the pending friend request
    addFriend: async (parent, { requesterId }, context) => {
      if (context.user) {
        const user = await User.findOneAndUpdate(
          { _id: context.user._id },
          { $addToSet: { friends: requesterId } },
          { $pull: { pendingFriends: requesterId } },
          { new: true }
        );

        return user;
      }
    },

    //*posts directly to someone's profile
    addGraffiti: async (parent, { receivingUser, postText }, context) => {
      //*context.user is the poster
      if (context.user) {
        const newGraffiti = await GraffitiPost.create({
          postingUser: context.user._id,
          receivingUser: receivingUser,
          postText: postText,
        });

        //*putting this on the receiver's model
        const user = await User.findOneAndUpdate(
          { _id: receivingUser },
          { $addToSet: { graffitiPosts: newGraffiti } },
          { new: true }
        );

        return newGraffiti;
      }
    },

    //*creates a messaging thread with someone
    createMessageThread: async (parent, { recipientId }, context) => {
      //?how to add the users to this
      //?update it
      if (context.user) {
        const newMessageThread = await Message.create({
          chatters: [context.user._id, recipientId],
        });

        const contextUser = await User.findByIdAndUpdate(
          { _id: context.user._id },
          { $addToSet: { messages: newMessageThread._id } }
        );

        const recipientUser = await User.findByIdAndUpdate(
          { _id: recipientId },
          { $addToSet: { messages: newMessageThread._id } }
        );

        return newMessageThread;
      }
    },

    sendMessage: async (parent, { threadId, messageContent }, context) => {
      if (context.user) {
        const sendMessage = await Message.findOneAndUpdate(
          { _id: threadId },
          {
            $addToSet: {
              dm: {
                messageContent: messageContent,
                messageAuthor: context.user._id,
              },
            },
          },
          { new: true }
        );

        return sendMessage;
      }
    },
  },
};

module.exports = resolvers;
