const fs = require("fs");
const axios = require("axios");
const { apiUrl, apiToken } = require("../config");
const path = require("path");
const util = require("util");

let workers = []; // Store the worker data
const writeFileAsync = util.promisify(fs.writeFile);

const updateWorkerData = async (newDevices) => {
    console.log("Updating worker data...");
    newDevices.forEach((newDevice) => {
        const existingDeviceIndex = workers.findIndex(
            (device) => device.device_id === newDevice.device_id
        );
        if (existingDeviceIndex !== -1) {
            // Device is already in the workers array, update it
            workers[existingDeviceIndex] = {
                ...workers[existingDeviceIndex],
                ...newDevice,
            };
        } else {
            // Device is not in the workers array, add it
            workers.push(newDevice);
        }
    });

    const filePath = path.join(__dirname, "../db/workerData.json");
    const dirPath = path.join(__dirname, "../db");

    // Create the db directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the updated data to the JSON file
    try {
        await writeFileAsync(filePath, JSON.stringify(workers, null, 2));
        console.log("workerData.json updated.");
    } catch (err) {
        console.error("JSON write error: ", err);
    }
};

const fetchData = async (page = 1, pageSize = 100) => {
    try {
        console.log("Data fetching started..");
        const res = await axios.get(
            `${apiUrl}?page=${page}&page_size=${pageSize}`,
            {
                headers: {
                    Token: `${apiToken}`,
                },
            }
        );
        const data = res.data;
        if (data && data.data && data.data.devices) {
            await updateWorkerData(data.data.devices);
            if (page < data.data.total_pages) {
                console.log(
                    `Fetching continues...page: ${page + 1} of ${
                        data.data.total_pages
                    }\n`
                );
                setTimeout(() => {
                    fetchData(page + 1, pageSize);
                }, 350);
            } else {
                console.log("Data fetching completed!\n");
                // Data fetching is complete, immediately start the next fetchData call
                fetchData(); // Restart fetching from the first page
            }
        }
    } catch (error) {
        console.error("Data fetching error: ", error);
        // In case of error, try to restart the fetchData process after a delay
        setTimeout(fetchData, 1000 * 60); // Try again after 1 minute
    }
};

// Initial call to start the process
fetchData();

module.exports = {
    fetchData,
    workers,
};
