const Appointment = require("./appointment.model");

const { createAppointmentSchema } = require("./appointment.validation");

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

const createAppointment = async (req, res) => {
  try {
    const { error, value } = createAppointmentSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can create appointment slots",
      });
    }

    const { date, startTime, endTime } = value;

    const startMinutes = timeToMinutes(startTime);

    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    const appointmentDate = new Date(date);

    const startOfDay = new Date(appointmentDate);

    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(appointmentDate);

    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await Appointment.find({
      doctor: req.user.id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    const hasOverlap = existingAppointments.some((appointment) => {
      const existingStart = timeToMinutes(appointment.startTime);

      const existingEnd = timeToMinutes(appointment.endTime);

      return startMinutes < existingEnd && endMinutes > existingStart;
    });

    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: "Appointment slot overlaps with an existing slot",
      });
    }

    const appointment = await Appointment.create({
      doctor: req.user.id,
      date: appointmentDate,
      startTime,
      endTime,
    });

    return res.status(201).json({
      success: true,
      message: "Appointment slot created successfully",

      data: {
        appointment,
      },
    });
  } catch (error) {
    console.error("Create Appointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can view their appointments",
      });
    }

    const appointments = await Appointment.find({
      doctor: req.user.id,
    })
      .populate("patient", "name email role")
      .sort({
        date: 1,
        startTime: 1,
      });

    return res.status(200).json({
      success: true,
      message: "Appointments fetched successfully",
      data: {
        appointments,
      },
    });
  } catch (error) {
    console.error("Get Doctor Appointments Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
const getDoctorBookedAppointments = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can view booked appointments",
      });
    }

    const appointments = await Appointment.find({
      doctor: req.user.id,
      status: "BOOKED",
    })
      .populate("patient", "name email role")
      .sort({
        date: 1,
        startTime: 1,
      });

    return res.status(200).json({
      success: true,
      message: "Booked appointments fetched successfully",
      data: {
        appointments,
      },
    });
  } catch (error) {
    console.error("Get Doctor Booked Appointments Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



const getAvailableAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      status: "AVAILABLE",
    })
      .populate("doctor", "name email")
      .sort({
        date: 1,
        startTime: 1,
      });

    return res.status(200).json({
      success: true,
      message: "Available appointments fetched successfully",
      data: {
        appointments,
      },
    });
  } catch (error) {
    console.error(
      "Get Available Appointments Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAppointment,
  getDoctorAppointments,
  getDoctorBookedAppointments,
  getAvailableAppointments
};
