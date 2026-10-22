const mongoose = require("mongoose");

const Booking = require("./booking.model");
const Appointment = require("../appointment/appointment.model");
const { createBookingSchema } = require("./booking.validation");

const isTransactionSupported = () => {
  const topology = mongoose.connection.client?.topology;
  const desc = topology?.description;
  if (!desc) return false;

  if (desc.type === "ReplicaSetWithPrimary" || desc.type === "Sharded") {
    return true;
  }

  if (desc.servers) {
    for (const server of desc.servers.values()) {
      if (server.type === "RSPrimary" || server.setName) {
        return true;
      }
    }
  }

  return false;
};

const isWriteConflict = (error) => {
  return Boolean(
    error?.hasErrorLabel?.("TransientTransactionError") ||
    error?.errorLabelSet?.has?.("TransientTransactionError") ||
    error?.code === 112 ||
    (typeof error?.message === "string" && error.message.includes("Write conflict"))
  );
};

const createBooking = async (req, res) => {
  if (req.user.role !== "PATIENT") {
    return res.status(403).json({
      success: false,
      message: "Only patients can book appointments",
    });
  }

  const { error, value } = createBookingSchema.validate(req.body, {
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

  const { appointmentId } = value;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let session = null;
    let appointmentClaimed = false;

    try {
      const useTransaction = isTransactionSupported();

      if (useTransaction) {
        session = await mongoose.startSession();
        session.startTransaction();
      }

      const sessionOpts = session ? { session } : {};

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
          ...sessionOpts,
        },
      );

      if (!appointment) {
        if (session && session.inTransaction()) {
          await session.abortTransaction();
        }

        return res.status(409).json({
          success: false,
          message: "Appointment is not available",
        });
      }

      appointmentClaimed = true;

      if (process.env.TEST_TRANSACTION === "true") {
        throw new Error("Transaction rollback test");
      }

      const [booking] = await Booking.create(
        [
          {
            appointment: appointment._id,
            patient: req.user.id,
          },
        ],
        sessionOpts,
      );

      if (session && session.inTransaction()) {
        await session.commitTransaction();
      }

      return res.status(201).json({
        success: true,
        message: "Appointment booked successfully",
        data: {
          booking,
          appointment,
        },
      });
    } catch (err) {
      if (session && session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          console.error("Error aborting transaction:", abortErr);
        }
      } else if (appointmentClaimed && appointmentId) {
        try {
          await Appointment.findByIdAndUpdate(appointmentId, {
            $set: { status: "AVAILABLE", patient: null },
          });
        } catch (revertErr) {
          console.error("Failed to revert appointment status on standalone:", revertErr);
        }
      }

      if (isWriteConflict(err) && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }

      console.error("Create Booking Error:", err.message);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }
};

module.exports = {
  createBooking,
  isTransactionSupported,
};
