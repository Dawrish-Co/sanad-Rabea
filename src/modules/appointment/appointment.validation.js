const Joi = require("joi");

const createAppointmentSchema = Joi.object({
  date: Joi.date().required(),

  startTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .required(),

  endTime: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .required(),
});

module.exports = {
  createAppointmentSchema,
};
