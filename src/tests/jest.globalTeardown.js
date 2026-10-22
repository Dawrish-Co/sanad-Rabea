const { stopReplicaSet } = require("./replicaSetManager");

module.exports = async () => {
  try {
    await stopReplicaSet();
  } catch (err) {
    console.warn("Notice: Local Replica Set teardown:", err.message);
  }
};
