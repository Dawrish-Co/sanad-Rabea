const mongoose = require("mongoose");

const Booking = require("./booking.model");
const Appointment = require("../appointment/appointment.model");

const createBooking = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "Only patients can book appointments",
      });
    }

    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    session.startTransaction();

    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        status: "AVAILABLE",
      },
      {
        $set: {
          status: "BOOKED",
          patient: req.user.id,
        },
      },
      {
        returnDocument: "after",
        session,
      },
    );

    if (!appointment) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: "Appointment is not available",
      });
    }

    // if (process.env.TEST_TRANSACTION === "true") {
    //   throw new Error("Transaction rollback test");
    // }

    const [booking] = await Booking.create(
      [
        {
          appointment: appointment._id,
          patient: req.user.id,
        },
      ],
      {
        session,
      },
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        booking,
        appointment,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Create Booking Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createBooking,
};
