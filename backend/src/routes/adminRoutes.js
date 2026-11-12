const express = require('express');
const adminUserController = require('../controllers/adminUserController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Enforce authentication and Administrator RBAC across all /admin routes
router.use(protect);
router.use(authorizeRoles(ROLES.ADMIN));

router.get('/users', adminUserController.listUsers);
router.patch('/users/:id/verify', adminUserController.verifyUser);
router.patch('/users/:id/deactivate', adminUserController.deactivateUser);
router.get('/donations', adminUserController.listAdminDonations);

module.exports = router;
