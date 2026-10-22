const { startReplicaSet } = require("./replicaSetManager");

module.exports = async () => {
  try {
    const uri = await startReplicaSet();
    process.env.TEST_MONGO_URI = uri;
  } catch (err) {
    console.warn("Notice: Local Replica Set auto-start failed:", err.message);
  }
};
