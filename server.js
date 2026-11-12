/**
 * Share A Plate - Root Server Entry Point
 * Delegates directly to official MERN backend in backend/server.js
 */
const path = require('path');

// Change working directory to backend so relative paths and backend/.env are loaded correctly
process.chdir(path.join(__dirname, 'backend'));

require(path.join(__dirname, 'backend', 'server.js'));
