"use strict";

const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { performance } = require("perf_hooks");
const { execFile } = require("child_process");

const app = express();

const PORT = Number(process.env.PORT || 3001);

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Root directory used by the server for datasets and processing results.
// Set this in your Linux environment, for example:
//
// DATA_ROOT=/home/researcher/esac
//
// The default is a local "data" directory inside the project.
const DATA_ROOT = process.env.DATA_ROOT || path.join(__dirname, "data");

// Directory containing the pose-estimation scripts.
const SCRIPT_DIR = process.env.SCRIPT_DIR || path.join(__dirname, "scripts");

const ESAC_SCRIPT =
  process.env.ESAC_SCRIPT || path.join(SCRIPT_DIR, "ARscript.sh");

const ACE_SCRIPT =
  process.env.ACE_SCRIPT || path.join(SCRIPT_DIR, "fbs.sh");

// Calibration file.
const CALIBRATION_FILE =
  process.env.CALIBRATION_FILE || path.join(DATA_ROOT, "MobCalib.txt");

// -----------------------------------------------------------------------------
// Express configuration
// -----------------------------------------------------------------------------

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// -----------------------------------------------------------------------------
// Runtime data
// -----------------------------------------------------------------------------

// Stores upload duration for a specific user/image combination.
// This avoids the old global uploadDur variable, which could be overwritten
// when multiple requests were processed at the same time.
const uploadTimings = new Map();

// Used only for generating the timer CSV row number.
let fileCounter = 1;

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

function sendError(res, statusCode, message, error = null) {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }

  return res.status(statusCode).json({
    error: message,
  });
}

function validateUserId(userId) {
  return (
    typeof userId === "string" &&
    userId.trim().length > 0 &&
    userId.length <= 200
  );
}

function validateImageName(imageName) {
  return (
    typeof imageName === "string" &&
    imageName.trim().length > 0 &&
    imageName.length <= 200 &&
    !imageName.includes("/") &&
    !imageName.includes("\\") &&
    !imageName.includes("..")
  );
}

function getUserDirectory(userId) {
  return path.join(DATA_ROOT, `test_${userId}`);
}

function getUserRgbDirectory(userId) {
  return path.join(getUserDirectory(userId), "rgb");
}

function getUserCalibrationDirectory(userId) {
  return path.join(getUserDirectory(userId), "calibration");
}

function getUserPoseDirectory(userId) {
  return path.join(getUserDirectory(userId), "poses");
}

function getEsacPoseOutputFile(userId) {
  return path.join(
    DATA_ROOT,
    "esac",
    "environments",
    "fbs",
    `poses_esac_${userId}.txt`
  );
}

function getEsacTemporaryPoseFile(userId) {
  return path.join(
    DATA_ROOT,
    "esac",
    "datasets",
    "fbs",
    `temp_${userId}`,
    `poses_esac_${userId}.txt`
  );
}

function getEsacTimerFile(userId) {
  return path.join(DATA_ROOT, "esac", "datasets", "fbs", `test_${userId}.timer.csv`);
}

function getAcePoseFile(userId) {
  return path.join(
    DATA_ROOT,
    "ace",
    "datasets",
    "fbs",
    `poses_ace_${userId}.txt`
  );
}

function getAceTimerFile(userId) {
  return path.join(DATA_ROOT, "ace", "datasets", "fbs", `test_${userId}.timer.csv`);
}

// -----------------------------------------------------------------------------
// Directory management
// -----------------------------------------------------------------------------

async function createFolders(userId) {
  const directories = [
    getUserDirectory(userId),
    getUserCalibrationDirectory(userId),
    getUserPoseDirectory(userId),
    getUserRgbDirectory(userId),
  ];

  await Promise.all(
    directories.map((directory) =>
      fsp.mkdir(directory, { recursive: true })
    )
  );
}

async function deleteFolderData(userId) {
  const directories = [
    getUserRgbDirectory(userId),
    getUserPoseDirectory(userId),
    getUserCalibrationDirectory(userId),
  ];

  for (const directory of directories) {
    try {
      const files = await fsp.readdir(directory);

      await Promise.all(
        files.map((file) =>
          fsp.unlink(path.join(directory, file)).catch((error) => {
            console.error(`Unable to delete ${file}:`, error);
          })
        )
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Calibration
// -----------------------------------------------------------------------------

async function readCalibrationData() {
  const data = await fsp.readFile(CALIBRATION_FILE, "utf8");

  try {
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Invalid calibration JSON in ${CALIBRATION_FILE}`);
  }
}

// -----------------------------------------------------------------------------
// Pose file utilities
// -----------------------------------------------------------------------------

async function findPoseLine(filePath, imageName) {
  const data = await fsp.readFile(filePath, "utf8");

  const lines = data.split(/\r?\n/);

  const expectedPrefix = `${imageName}.jpg`;

  return (
    lines.find((line) => line.startsWith(expectedPrefix)) || null
  );
}

async function appendLine(filePath, line) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.appendFile(filePath, `${line}\n`, "utf8");
}

// -----------------------------------------------------------------------------
// External processing
// -----------------------------------------------------------------------------

function runProcessingScript(scriptPath, userId) {
  return new Promise((resolve, reject) => {
    console.log(`Starting processing script: ${scriptPath}`);
    console.log(`User ID: ${userId}`);

    const process = execFile(
      scriptPath,
      [userId],
      {
        maxBuffer: 50 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (stdout) {
          console.log(`stdout:\n${stdout}`);
        }

        if (stderr) {
          console.log(`stderr:\n${stderr}`);
        }

        if (error) {
          reject(error);
          return;
        }

        resolve({
          stdout,
          stderr,
        });
      }
    );

    process.on("error", (error) => {
      reject(error);
    });
  });
}

// -----------------------------------------------------------------------------
// Upload timing
// -----------------------------------------------------------------------------

function setUploadTiming(userId, imageName, duration) {
  const key = `${userId}:${imageName}`;
  uploadTimings.set(key, duration);

  // Prevent unlimited growth of the Map.
  setTimeout(() => {
    uploadTimings.delete(key);
  }, 10 * 60 * 1000);
}

function getUploadTiming(userId, imageName) {
  const key = `${userId}:${imageName}`;
  return uploadTimings.get(key) || 0;
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

/**
 * Basic connection test.
 */
app.get("/checkConnection", (req, res) => {
  res.status(200).json({
    status: "Connected",
  });
});

/**
 * Health endpoint.
 *
 * This is useful for checking whether the server is running.
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ARProcessingServer",
  });
});

/**
 * Create user/session folders.
 */
app.post("/createfolder", async (req, res) => {
  try {
    const userId = req.body?.userId;

    if (!validateUserId(userId)) {
      return sendError(res, 400, "A valid userId is required.");
    }

    await createFolders(userId);

    return res.status(200).json({
      status: "Folder created successfully",
      userId,
    });
  } catch (error) {
    return sendError(res, 500, "Unable to create folders.", error);
  }
});

/**
 * Receive mobile phone model and return calibrated camera information.
 *
 * Existing Unity endpoint:
 * POST /send-PhoneModel
 */
app.post("/send-PhoneModel", async (req, res) => {
  try {
    let phoneModel;

    if (typeof req.body === "string") {
      phoneModel = req.body;
    } else if (req.body?.MobileModel) {
      phoneModel = req.body.MobileModel;
    } else if (req.body?.phoneModel) {
      phoneModel = req.body.phoneModel;
    } else {
      phoneModel = String(req.body || "").trim();
    }

    phoneModel = phoneModel.trim();

    if (!phoneModel) {
      return sendError(res, 400, "Phone model is required.");
    }

    const calibrationData = await readCalibrationData();

    const calibration = calibrationData?.[0]?.[phoneModel];

    if (calibration === undefined) {
      return sendError(
        res,
        404,
        `No calibration data found for phone model: ${phoneModel}`
      );
    }

    return res.status(200).send(`Your Phone Model is ${calibration}`);
  } catch (error) {
    return sendError(res, 500, "Unable to read phone calibration data.", error);
  }
});

/**
 * Receive user ID and mobile model.
 *
 * Existing Unity endpoint:
 * POST /send-User
 */
app.post("/send-User", async (req, res) => {
  try {
    const userId = req.body?.userId;
    const mobileModel = req.body?.MobileModel;

    if (!validateUserId(userId)) {
      return sendError(res, 400, "A valid userId is required.");
    }

    if (
      typeof mobileModel !== "string" ||
      mobileModel.trim().length === 0
    ) {
      return sendError(res, 400, "MobileModel is required.");
    }

    const calibrationData = await readCalibrationData();

    const cameraCalibration =
      calibrationData?.[0]?.[mobileModel];

    if (cameraCalibration === undefined) {
      return sendError(
        res,
        404,
        `No calibration data found for mobile model: ${mobileModel}`
      );
    }

    await createFolders(userId);

    return res.status(200).send(String(cameraCalibration));
  } catch (error) {
    return sendError(
      res,
      500,
      "Unable to process user/calibration information.",
      error
    );
  }
});

/**
 * Upload image from Unity.
 *
 * Expected request:
 *
 * {
 *   "pngData": "...base64...",
 *   "userId": "...",
 *   "MobileModel": "...",
 *   "cameraCalib": "...",
 *   "ImageName": "..."
 * }
 */
app.post("/upload-image", async (req, res) => {
  const uploadStart = performance.now();

  try {
    const {
      pngData,
      userId,
      MobileModel,
      cameraCalib,
      ImageName,
    } = req.body || {};

    if (!validateUserId(userId)) {
      return sendError(res, 400, "A valid userId is required.");
    }

    if (!validateImageName(ImageName)) {
      return sendError(res, 400, "A valid ImageName is required.");
    }

    if (
      typeof pngData !== "string" ||
      pngData.length === 0
    ) {
      return sendError(res, 400, "pngData is required.");
    }

    if (
      typeof cameraCalib !== "string" &&
      typeof cameraCalib !== "object"
    ) {
      return sendError(res, 400, "cameraCalib is required.");
    }

    console.log("Uploading image");
    console.log("User ID:", userId);
    console.log("Image Name:", ImageName);
    console.log("Mobile Model:", MobileModel);

    await createFolders(userId);

    const imagePath = path.join(
      getUserRgbDirectory(userId),
      `${ImageName}.jpg`
    );

    const calibrationPath = path.join(
      getUserCalibrationDirectory(userId),
      `${ImageName}.jpg.calibration.txt`
    );

    const posePath = path.join(
      getUserPoseDirectory(userId),
      `${ImageName}.jpg.poses.txt`
    );

    // Decode Base64 image.
    const imageBuffer = Buffer.from(pngData, "base64");

    // Save image.
    await fsp.writeFile(imagePath, imageBuffer);

    // Save calibration.
    const calibrationContent =
      typeof cameraCalib === "string"
        ? cameraCalib
        : JSON.stringify(cameraCalib);

    await fsp.writeFile(
      calibrationPath,
      calibrationContent,
      "utf8"
    );

    // Initial identity pose.
    //
    // This preserves the behaviour of the original server.
    const initialPose =
      "1 0 0 0\n" +
      "0 1 0 0\n" +
      "0 0 1 0\n" +
      "0 0 0 1";

    await fsp.writeFile(
      posePath,
      initialPose,
      "utf8"
    );

    const uploadDuration = performance.now() - uploadStart;

    setUploadTiming(
      userId,
      ImageName,
      uploadDuration
    );

    const currentFileNumber = fileCounter++;

    console.log(
      `Image ${ImageName} uploaded in ${uploadDuration.toFixed(2)} ms`
    );

    return res.status(200).send(String(currentFileNumber));
  } catch (error) {
    return sendError(res, 500, "Unable to upload image.", error);
  }
});

/**
 * Run ESAC processing pipeline.
 *
 * Existing Unity endpoint:
 * POST /runBatchFile
 */
app.post("/runBatchFile", async (req, res) => {
  const processingStart = performance.now();

  try {
    const ImageName = req.body?.ImageName;
    const userId = req.body?.userId;

    if (!validateUserId(userId)) {
      return sendError(res, 400, "A valid userId is required.");
    }

    if (!validateImageName(ImageName)) {
      return sendError(res, 400, "A valid ImageName is required.");
    }

    console.log("Running ESAC processing");
    console.log("User ID:", userId);
    console.log("Image Name:", ImageName);

    await runProcessingScript(
      ESAC_SCRIPT,
      userId
    );

    const poseOutputFile =
      getEsacPoseOutputFile(userId);

    const poseLine = await findPoseLine(
      poseOutputFile,
      ImageName
    );

    if (!poseLine) {
      return sendError(
        res,
        404,
        `Pose data for ${ImageName}.jpg was not found.`
      );
    }

    console.log("Pose:", poseLine);

    // Store the returned pose.
    await appendLine(
      getEsacTemporaryPoseFile(userId),
      poseLine
    );

    const processingDuration =
      performance.now() - processingStart;

    const uploadDuration =
      getUploadTiming(userId, ImageName);

    const totalDuration =
      uploadDuration + processingDuration;

    await appendTimerData(
      getEsacTimerFile(userId),
      ImageName,
      uploadDuration,
      processingDuration,
      totalDuration
    );

    console.log(
      `Upload: ${uploadDuration.toFixed(2)} ms`
    );

    console.log(
      `ESAC processing: ${processingDuration.toFixed(2)} ms`
    );

    console.log(
      `Total: ${totalDuration.toFixed(2)} ms`
    );

    return res.status(200).send(poseLine);
  } catch (error) {
    return sendError(
      res,
      500,
      "ESAC processing failed.",
      error
    );
  }
});

/**
 * Run ACE processing pipeline.
 *
 * Existing Unity endpoint:
 * POST /runAceBatchFile
 */
app.post("/runAceBatchFile", async (req, res) => {
  const processingStart = performance.now();

  try {
    const ImageName = req.body?.ImageName;
    const userId = req.body?.userId;

    if (!validateUserId(userId)) {
      return sendError(res, 400, "A valid userId is required.");
    }

    if (!validateImageName(ImageName)) {
      return sendError(res, 400, "A valid ImageName is required.");
    }

    console.log("Running ACE processing");
    console.log("User ID:", userId);
    console.log("Image Name:", ImageName);

    await runProcessingScript(
      ACE_SCRIPT,
      userId
    );

    const aceOutputFile = path.join(
      DATA_ROOT,
      "ace",
      "output",
      "fbs",
      "merged_poses_4.txt"
    );

    const poseLine = await findPoseLine(
      aceOutputFile,
      ImageName
    );

    if (!poseLine) {
      return sendError(
        res,
        404,
        `ACE pose data for ${ImageName}.jpg was not found.`
      );
    }

    console.log("ACE Pose:", poseLine);

    await appendLine(
      getAcePoseFile(userId),
      poseLine
    );

    const processingDuration =
      performance.now() - processingStart;

    const uploadDuration =
      getUploadTiming(userId, ImageName);

    const totalDuration =
      uploadDuration + processingDuration;

    await appendTimerData(
      getAceTimerFile(userId),
      ImageName,
      uploadDuration,
      processingDuration,
      totalDuration
    );

    console.log(
      `Upload: ${uploadDuration.toFixed(2)} ms`
    );

    console.log(
      `ACE processing: ${processingDuration.toFixed(2)} ms`
    );

    console.log(
      `Total: ${totalDuration.toFixed(2)} ms`
    );

    return res.status(200).send(poseLine);
  } catch (error) {
    return sendError(
      res,
      500,
      "ACE processing failed.",
      error
    );
  }
});

/**
 * Read the next pose associated with the requested image.
 *
 * Existing endpoint:
 * GET /readPosesfile
 *
 * The original implementation relied on the global connectedUserID
 * and fileCounter. This version uses the userId supplied by the client.
 */
app.get("/readPosesfile", async (req, res) => {
  try {
    const userId = req.query.userId;
    const imageName = req.query.ImageName;

    if (!validateUserId(userId)) {
      return sendError(res, 400, "A valid userId is required.");
    }

    if (!validateImageName(imageName)) {
      return sendError(res, 400, "A valid ImageName is required.");
    }

    const poseFile = getEsacPoseOutputFile(userId);

    const poseLine = await findPoseLine(
      poseFile,
      imageName
    );

    if (!poseLine) {
      return sendError(
        res,
        404,
        `Pose data for ${imageName}.jpg was not found.`
      );
    }

    return res.status(200).send(poseLine);
  } catch (error) {
    return sendError(
      res,
      500,
      "Unable to read pose data.",
      error
    );
  }
});

// -----------------------------------------------------------------------------
// Timer logging
// -----------------------------------------------------------------------------

async function appendTimerData(
  filePath,
  imageName,
  uploadDuration,
  processingDuration,
  totalDuration
) {
  const line =
    `${Date.now()},` +
    `${imageName}.jpg, ` +
    `${uploadDuration},` +
    `${processingDuration},` +
    `${totalDuration}\n`;

  await fsp.mkdir(
    path.dirname(filePath),
    { recursive: true }
  );

  await fsp.appendFile(
    filePath,
    line,
    "utf8"
  );
}

// -----------------------------------------------------------------------------
// Error handling
// -----------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    error: "Internal server error",
  });
});

// -----------------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log("========================================");
  console.log("ARProcessingServer");
  console.log("========================================");
  console.log(`Server running on port ${PORT}`);
  console.log(`Data root: ${DATA_ROOT}`);
  console.log(`ESAC script: ${ESAC_SCRIPT}`);
  console.log(`ACE script: ${ACE_SCRIPT}`);
  console.log("========================================");
});