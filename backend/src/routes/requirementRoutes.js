const express = require('express');
const requirementController = require('../controllers/requirementController');
const { protect } = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const requireVerified = require('../middlewares/verificationMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { createRequirementSchema } = require('../validations/requirementValidation');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  authorizeRoles(ROLES.RECIPIENT, ROLES.ADMIN),
  requireVerified,
  validate({ body: createRequirementSchema }),
  requirementController.createRequirement
);

router.get('/', requirementController.listRequirements);
router.get('/:id', requirementController.getRequirementById);

module.exports = router;
