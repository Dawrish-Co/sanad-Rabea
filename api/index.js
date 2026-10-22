const app = require("../src/app");
const connectDB = require("../src/config/database");

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected && process.env.MONGO_URI) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error("Serverless database connection error:", err.message);
    }
  }
  return app(req, res);
};
