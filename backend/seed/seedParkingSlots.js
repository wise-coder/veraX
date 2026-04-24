require("dotenv").config();

const connectDB = require("../config/db");
const ParkingSlot = require("../models/ParkingSlot");

const seedParkingSlots = async () => {
  try {
    await connectDB();

    const slotsToCreate = [];

    for (let index = 1; index <= 20; index += 1) {
      const slotNumber = `P${index}`;
      const existingSlot = await ParkingSlot.findOne({ slotNumber });

      if (!existingSlot) {
        slotsToCreate.push({
          slotNumber,
          status: "available",
          positionIndex: index,
        });
      }
    }

    if (slotsToCreate.length) {
      await ParkingSlot.insertMany(slotsToCreate);
    }

    console.log(`Parking slots ready. Created ${slotsToCreate.length} new slot(s).`);
    process.exit(0);
  } catch (error) {
    console.error(`Failed to seed parking slots: ${error.message}`);
    process.exit(1);
  }
};

seedParkingSlots();
