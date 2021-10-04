import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import { connectToDatabase } from "../../../utils/mongodb";
import { OAuth2Client } from "google-auth-library";

const googleAuthClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_ID);

export default async function auth(req, res) {
  // For more information on each option (and a full list of options) go to
  // https://next-auth.js.org/configuration/options
  return await NextAuth(req, res, {
    // https://next-auth.js.org/configuration/providers
    providers: [
      // Providers.Email({
      //   server: process.env.EMAIL_SERVER,
      //   from: process.env.EMAIL_FROM,
      // }),
      // Temporarily removing the Apple provider from the demo site as the
      // callback URL for it needs updating due to Vercel changing domains
      /*
    Providers.Apple({
      clientId: process.env.APPLE_ID,
      clientSecret: {
        appleId: process.env.APPLE_ID,
        teamId: process.env.APPLE_TEAM_ID,
        privateKey: process.env.APPLE_PRIVATE_KEY,
        keyId: process.env.APPLE_KEY_ID,
      },
    }),
    */
      // Providers.Facebook({
      //   clientId: process.env.FACEBOOK_ID,
      //   clientSecret: process.env.FACEBOOK_SECRET,
      // }),
      // Providers.GitHub({
      //   clientId: process.env.GITHUB_ID,
      //   clientSecret: process.env.GITHUB_SECRET,
      //   // https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
      //   scope: "read:user",
      // }),
      Providers.Google({
        clientId: process.env.GOOGLE_ID,
        clientSecret: process.env.GOOGLE_SECRET,
      }),
      // Providers.Twitter({
      //   clientId: process.env.TWITTER_ID,
      //   clientSecret: process.env.TWITTER_SECRET,
      // }),
      // Providers.Auth0({
      //   clientId: process.env.AUTH0_ID,
      //   clientSecret: process.env.AUTH0_SECRET,
      //   domain: process.env.AUTH0_DOMAIN,
      // }),
      Providers.Credentials({
        // The id of this credential provider. It's important to give an id because, in frontend we don't want to
        // show anything about this provider in a normal login flow
        id: "googleonetap",
        // A readable name
        name: "google-one-tap",

        // This field define what parameter we expect from the FE and what's its name. In this case "credential"
        // This field will contain the token generated by google
        credentials: {
          credential: { type: "text" },
        },
        // This is where all the logic goes
        authorize: async (credentials) => {
          // The token given by google and provided from the frontend
          const token = credentials.credential;
          // We use the google library to exchange the token with some information about the user
          const ticket = await googleAuthClient.verifyIdToken({
            // The token received from the interface
            idToken: token,
            // This is the google ID of your application
            audience: process.env.NEXT_PUBLIC_GOOGLE_ID,
          });
          const payload = ticket.getPayload(); // This is the user

          if (!payload) {
            throw new Error("Cannot extract payload from signin token");
          }

          // If the request went well, we received all this info from Google.
          const {
            email,
            sub,
            given_name,
            family_name,
            email_verified,
            picture: image,
          } = payload;
          console.log("SUB", sub, email);
          // If for some reason the email is not provided, we cannot login the user with this method
          if (!email) {
            throw new Error("Email not available");
          }

          console.log(process.env.MONGODB_DB);

          // Let's check on our DB if the user exists
          const { client } = await connectToDatabase();
          const db = await client.db(process.env.MONGODB_DB);
          let user = await db.collection("users").find({ email }).toArray();

          console.log("user", user);

          // If there's no user, we need to create it
          if (!user || user.length < 1) {
            user = await db
              .collection("users")
              .insertOne({
                name: [given_name, family_name].join(" "),
                email,
                image,
                emailVerified: email_verified ? new Date() : undefined,
              })
              .toArray();
          }

          console.log("user", user);

          // Let's also retrieve any account for the user from the DB, if any
          const account = await db
            .collection("accounts")
            .find({ providerId: "google", providerAccountId: sub })
            .toArray();

          console.log("account", account);

          // In case the account is not yet present on our DB, we want to create one and link to the user
          if (account.length < 1 && user) {
            await db.collection("accounts").insertOne({
              userId: user._id,
              providerId: "google",
              providerAccountId: sub,
              accessToken: null,
              accessTokenExpires: null,
              refresh_token: null,
            });
          }
          // We can finally returned the retrieved or created user
          return user[0];
        },
      }),
    ],
    // Database optional. MySQL, Maria DB, Postgres and MongoDB are supported.
    // https://next-auth.js.org/configuration/databases
    //
    // Notes:
    // * You must install an appropriate node_module for your database
    // * The Email provider requires a database (OAuth providers do not)
    database: process.env.DATABASE_URL,

    // The secret should be set to a reasonably long random string.
    // It is used to sign cookies and to sign and encrypt JSON Web Tokens, unless
    // a separate secret is defined explicitly for encrypting the JWT.
    secret: process.env.SECRET,

    session: {
      // Use JSON Web Tokens for session instead of database sessions.
      // This option can be used with or without a database for users/accounts.
      // Note: `jwt` is automatically set to `true` if no database is specified.
      jwt: true,

      // Seconds - How long until an idle session expires and is no longer valid.
      // maxAge: 30 * 24 * 60 * 60, // 30 days

      // Seconds - Throttle how frequently to write to database to extend a session.
      // Use it to limit write operations. Set to 0 to always update the database.
      // Note: This option is ignored if using JSON Web Tokens
      // updateAge: 24 * 60 * 60, // 24 hours
    },

    // JSON Web tokens are only used for sessions if the `jwt: true` session
    // option is set - or by default if no database is specified.
    // https://next-auth.js.org/configuration/options#jwt
    jwt: {
      // A secret to use for key generation (you should set this explicitly)
      // secret: 'INp8IvdIyeMcoGAgFGoA61DdBglwwSqnXJZkgz8PSnw',
      // Set to true to use encryption (default: false)
      // encryption: true,
      // You can define your own encode/decode functions for signing and encryption
      // if you want to override the default behaviour.
      // encode: async ({ secret, token, maxAge }) => {},
      // decode: async ({ secret, token, maxAge }) => {},
    },

    // You can define custom pages to override the built-in ones. These will be regular Next.js pages
    // so ensure that they are placed outside of the '/api' folder, e.g. signIn: '/auth/mycustom-signin'
    // The routes shown here are the default URLs that will be used when a custom
    // pages is not specified for that route.
    // https://next-auth.js.org/configuration/pages
    pages: {
      // signIn: '/auth/signin',  // Displays signin buttons
      // signOut: '/auth/signout', // Displays form with sign out button
      // error: '/auth/error', // Error code passed in query string as ?error=
      // verifyRequest: '/auth/verify-request', // Used for check email page
      // newUser: null // If set, new users will be directed here on first sign in
    },

    // Callbacks are asynchronous functions you can use to control what happens
    // when an action is performed.
    // https://next-auth.js.org/configuration/callbacks
    callbacks: {
      // async signIn(user, account, profile) { return true },
      // async redirect(url, baseUrl) { return baseUrl },
      // async session(session, user) { return session },
      // async jwt(token, user, account, profile, isNewUser) { return token }
    },

    // Events are useful for logging
    // https://next-auth.js.org/configuration/events
    events: {},

    // You can set the theme to 'light', 'dark' or use 'auto' to default to the
    // whatever prefers-color-scheme is set to in the browser. Default is 'auto'
    theme: "light",

    // Enable debug messages in the console if you are having problems
    debug: false,
  });
}
