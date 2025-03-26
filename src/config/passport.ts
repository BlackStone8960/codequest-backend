import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GithubStrategy } from "passport-github2";
import User from "../models/User";

dotenv.config();

// Register Github strategy with passport
passport.use(
  new GithubStrategy(
    {
      // Set up Github strategy with client ID, client secret,
      // and callback URL which were generated from Github
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL!,
    },
    // Callback function which is called when user is authenticated
    // Github will send user's profile and tokens
    async (
      accessToken: string,
      refreshToken: string,
      profile: any,
      done: (error: any, user?: any) => void
    ) => {
      try {
        // Find user who already signed up with Github
        const existingUser = await User.findOne({ githubId: profile.id });

        // If user exists, return user
        if (existingUser) {
          return done(null, existingUser);
        }

        // If user does not exist, create new user
        const newUser = await User.create({
          username: profile.username || "NoUsername",
          email: profile.emails?.[0]?.value || "no-email@example.com", // Set dummy email if email is not public
          githubId: profile.id,
          avatarUrl: profile.photos?.[0]?.value, // Set avatar URL if user has Github avatar
          experience: 0,
          level: 1,
          tasksCompleted: [],
        });

        return done(null, newUser);
      } catch (error) {
        return done(error as any, undefined);
      }
    }
  )
);

// Serialize user to session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
