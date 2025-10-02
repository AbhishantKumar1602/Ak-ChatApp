// Authentication middleware: checks for session user
module.exports = function (req, res, next) {
    // If user is authenticated (session exists), continue
    if (req.session && req.session.user) {
        return next();
    }
    // For API requests, return 401
    if (req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // For page requests, redirect to login
    return res.redirect('/login');
};
