const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    try {
        let token = req.headers.authorization;
        if (token && token.startsWith("Bearer")) {
            token = token.split(" ")[1]; //Extract token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next();
        } else {
            res.status(401).json({ message: "not authorized to access this route" });
        }
    } catch (error) {
        res.status(401).json({ message: "Not authorized to access this route", error: error.message });
    }
}
//Middleware for Admin Only Access
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Admins Only" });
    }
}

//Export the authMiddleware
module.exports = { protect, adminOnly };