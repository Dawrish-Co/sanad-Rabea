const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const mongoose = require("mongoose");

const REPLSET_PORT = 27018;
const REPLSET_NAME = "rs0";
const REPLSET_DB_PATH = path.resolve(__dirname, "../../.test-rs-data");
const TEST_REPLSET_URI = `mongodb://127.0.0.1:${REPLSET_PORT}/sanad_test?replicaSet=${REPLSET_NAME}&directConnection=true`;

function isPortOpen(port, host = "127.0.0.1", timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function findMongod() {
  if (process.env.MONGOD_PATH && fs.existsSync(process.env.MONGOD_PATH)) {
    return process.env.MONGOD_PATH;
  }

  try {
    const res = execSync("where.exe mongod", { encoding: "utf8" }).trim().split(/\r?\n/)[0];
    if (res && fs.existsSync(res)) return res;
  } catch (e) {}

  const baseDir = "C:\\Program Files\\MongoDB\\Server";
  if (fs.existsSync(baseDir)) {
    const versions = fs.readdirSync(baseDir).sort().reverse();
    for (const v of versions) {
      const p = path.join(baseDir, v, "bin", "mongod.exe");
      if (fs.existsSync(p)) return p;
    }
  }

  for (const p of ["/usr/bin/mongod", "/usr/local/bin/mongod", "/opt/homebrew/bin/mongod"]) {
    if (fs.existsSync(p)) return p;
  }

  return "mongod";
}

const PID_FILE = path.join(REPLSET_DB_PATH, ".started_by_test");

async function startReplicaSet() {
  const isOpen = await isPortOpen(REPLSET_PORT);

  if (!isOpen) {
    const mongodPath = findMongod();
    if (!fs.existsSync(REPLSET_DB_PATH)) {
      fs.mkdirSync(REPLSET_DB_PATH, { recursive: true });
    }

    const mongodProcess = spawn(
      mongodPath,
      [
        "--port",
        String(REPLSET_PORT),
        "--dbpath",
        REPLSET_DB_PATH,
        "--replSet",
        REPLSET_NAME,
        "--bind_ip",
        "127.0.0.1",
        "--oplogSize",
        "64",
      ],
      {
        detached: true,
        stdio: "ignore",
      }
    );
    mongodProcess.unref();

    try {
      fs.writeFileSync(PID_FILE, String(mongodProcess.pid), "utf8");
    } catch (e) {}

    let connected = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isPortOpen(REPLSET_PORT)) {
        connected = true;
        break;
      }
    }

    if (!connected) {
      throw new Error("Timed out waiting for test Replica Set mongod to start on port " + REPLSET_PORT);
    }
  }

  const conn = await mongoose.createConnection(
    `mongodb://127.0.0.1:${REPLSET_PORT}/admin?directConnection=true`,
    { serverSelectionTimeoutMS: 5000 }
  ).asPromise();

  try {
    await conn.db.admin().command({
      replSetInitiate: {
        _id: REPLSET_NAME,
        members: [{ _id: 0, host: `127.0.0.1:${REPLSET_PORT}` }],
      },
    });
  } catch (err) {
    if (err.code !== 23 && !err.message.includes("already initialized")) {
      console.warn("replSetInitiate warning:", err.message);
    }
  }

  for (let i = 0; i < 20; i++) {
    const hello = await conn.db.admin().command({ hello: 1 });
    if (hello.isWritablePrimary) {
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  await conn.close();
  return TEST_REPLSET_URI;
}

async function stopReplicaSet(force = false) {
  const wasStartedByTest = fs.existsSync(PID_FILE);
  if (!force && !wasStartedByTest) {
    return;
  }

  if (!(await isPortOpen(REPLSET_PORT))) {
    if (wasStartedByTest) {
      try {
        fs.unlinkSync(PID_FILE);
      } catch (e) {}
    }
    return;
  }

  try {
    const conn = await mongoose.createConnection(
      `mongodb://127.0.0.1:${REPLSET_PORT}/admin?directConnection=true`,
      { serverSelectionTimeoutMS: 2000 }
    ).asPromise();

    await conn.db.admin().command({ shutdown: 1 }).catch(() => {});
    await conn.close();
  } catch (e) {}

  if (fs.existsSync(PID_FILE)) {
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {}
  }
}

module.exports = {
  REPLSET_PORT,
  REPLSET_NAME,
  TEST_REPLSET_URI,
  isPortOpen,
  findMongod,
  startReplicaSet,
  stopReplicaSet,
};
