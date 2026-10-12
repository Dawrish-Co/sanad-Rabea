const AuditLog = require("./audit.model");

const getAuditLogs = async (req, res) => {
  try {
    const auditLogs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .populate("actor", "name email role")
      .populate("patientId", "name email")
      .populate("recordId", "diagnosis notes");

    return res.status(200).json({
      success: true,
      count: auditLogs.length,
      data: auditLogs,
    });
  } catch (error) {
    console.error("Get Audit Logs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs",
    });
  }
};

module.exports = {
  getAuditLogs,
};
