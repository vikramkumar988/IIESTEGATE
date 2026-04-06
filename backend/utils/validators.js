const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const validateRegister = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['guard', 'staff', 'admin']).withMessage('Role must be guard, staff, or admin'),
  handleValidationErrors,
];

const validatePublicRegister = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['guard', 'staff']).withMessage('Role must be guard or staff'),
  body('organization').isIn(['iiest', 'bank', 'school', 'iti', 'other']).withMessage('Organization must be one of: iiest, bank, school, iti, other'),
  handleValidationErrors,
];

const validateVisitRequest = [
  body('visitor_name').trim().notEmpty().withMessage('Visitor name is required'),
  body('visitor_phone').trim().notEmpty().withMessage('Visitor phone is required'),
  body('staff_id').isUUID().withMessage('Valid staff ID is required'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  handleValidationErrors,
];

const validateGeneralVisit = [
  body('visitor_name').trim().notEmpty().withMessage('Visitor name is required'),
  body('visitor_phone').trim().notEmpty().withMessage('Visitor phone is required'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  body('validity_hours').isFloat({ min: 0.5, max: 24 }).withMessage('Validity must be between 0.5 and 24 hours'),
  handleValidationErrors,
];

const validatePreRegistration = [
  body('visitor_name').trim().notEmpty().withMessage('Visitor name is required'),
  body('visitor_phone').trim().notEmpty().withMessage('Visitor phone is required'),
  body('staff_id').isUUID().withMessage('Valid staff member is required'),
  body('purpose').trim().notEmpty().withMessage('Purpose of visit is required'),
  body('scheduled_date').notEmpty().withMessage('Scheduled date is required'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateRegister,
  validatePublicRegister,
  validateVisitRequest,
  validateGeneralVisit,
  validatePreRegistration,
};
