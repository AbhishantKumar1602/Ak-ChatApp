// Example authentication middleware
module.exports = function (req, res, next) {
    // You can check for a session, JWT, or any auth logic here
    // For demo, allow all requests (replace with real logic)
    // Example: if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    next();
};
