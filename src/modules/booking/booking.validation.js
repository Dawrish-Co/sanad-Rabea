const Joi = require("joi");

const createBookingSchema = Joi.object({
  appointmentId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      "string.empty": "Appointment ID is required",
      "string.hex": "Invalid appointment ID format",
      "string.length": "Invalid appointment ID format",
      "any.required": "Appointment ID is required",
    }),
});

module.exports = {
  createBookingSchema,
};
