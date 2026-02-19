import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";
import nudgeRoutes from "./routes/nudgeRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import plantumlRoutes from "./routes/plantumlRoutes.js";
import umlRoutes from "./routes/umlRoutes.js";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(cors({
  // origin: "http://localhost:5173",
  origin: process.env.FRONTEND_URL || "34.56.112.200:3000",
  credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback",
}, (accessToken, refreshToken, profile, done) => {
    // Here you can save/find the user in your DB if needed
    return done(null, profile);
}));

// Google OAuth routes
app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login", session: true }),
    (req, res) => {
        // Successful authentication, redirect to frontend
        res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
    }
);

// Auth check endpoint
app.get("/api/auth/check", (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Logout endpoint
app.get("/api/auth/logout", (req, res) => {
    req.logout(function(err) {
        if (err) { return res.status(500).json({ success: false, error: err.message }); }
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect((process.env.FRONTEND_URL || "http://localhost:5173") + "/login");
        });
    });
});

app.use("/api", chatRoutes);
app.use("/api", nudgeRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/plantuml", plantumlRoutes);
app.use("/api", umlRoutes);

app.get("/", (req, res) => {
    res.send("Server is ready");
});

app.listen(PORT, () => {
    connectDB();
    console.log("Server started at http://localhost:" + PORT);
});
