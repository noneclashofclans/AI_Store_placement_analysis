const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

// Register route
router.get("/register", (req, res) => {
  res.status(405).json({ message: "Use POST method to login" });
});

router.post("/register", async (req, res) => {
    const { email, password } = req.body; 
    
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); // 2^10 = 1024
        // Create a new user
        const newUser = new User({
            email,
            password: hashedPassword
        });
        await newUser.save();
        // Generate a JWT token
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.status(201).json({ token, user: { id: newUser._id, email: newUser.email } });

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Login route
router.get("/login", (req, res) => {
  res.status(405).json({ message: "Use POST method to login" });
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body; // post request was sent on login.jsx

    try{
        // checking if the user is already registered
        const user = await User.findOne({email: email});
        if (!user){
            return res.status(400).json({ message: "User not found" });
        }

        const isAvalidPassword = await bcrypt.compare(password, user.password);
        if (!isAvalidPassword){
            return res.status(400).json({ message: "Invalid password" });
        }
        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        });
        res.status(200).json({ token, user: { id: user._id, email: user.email } });

    }catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;