/**
 * Seed VERCEL Production Database
 * 
 * This uses the EXACT MongoDB URI from Vercel environment variables
 */

const mongoose = require('mongoose');
const readline = require('readline');

// VERCEL PRODUCTION URI
const VERCEL_MONGODB_URI = 'mongodb+srv://agottges_db_user:ibnnjPxUR7ueo9ov@agi-property-inspection.6e3skrc.mongodb.net/agi-inspections?retryWrites=true&w=majority&appName=agi-property-inspection';

// Schema matching production database structure
const SectionChecklistSchema = new mongoose.Schema({
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  text: String,
  value: String,
  comment: String,
  type: String,
  tab: String,
  answer_choices: [String],
  order_index: Number
}, { collection: 'sectionchecklists', timestamps: true });

const SectionChecklist = mongoose.model('SectionChecklist', SectionChecklistSchema);

// Complete mapping of answer choices
const answerChoicesMap = {
  // Section 1 - Inspection Details (7 items)
  'General: Type of Inspection': ['Pre-Purchase', 'Pre-Listing', 'Warranty Expiration', 'New Build', '4-Point', 'Roof (only)', 'Electrical', 'Warranty Inspection', 'Repair Inspection'],
  'General: Style of Home': ['Ranch', 'Manufactured', 'Condo', 'Duplex', 'Four-plex', '8-plex', 'Modular', 'Barn dominium', 'Modern', 'Commercial', 'Single-Family', 'Multi-Family'],
  'General: In Attendance': ['Client', 'Buyer Agent', 'Listing Agent', 'Seller', 'Tenant', 'None', 'Family of the Client', 'Contractors', 'Owner', 'Agent Representative', 'Owner Representative'],
  'General: Occupancy': ['Furnished', 'Vacant', 'Occupied', 'Unfurnished', 'Mostly Vacant', 'Staged', 'Partially Occupied', 'Under Construction', 'Remodeled', 'New Construction'],
  'General: Utilities': ['Water', 'Gas', 'Electric', 'Propane', 'All Off', 'All On', 'Gas - Off', 'Water - Off'],
  'General: Weather': ['Rain', 'Recent Rain', 'Clear', 'Snow', 'Recent snow', 'Below freezing', 'Cloudy', 'Fog', 'Heavy Rain', 'Cold', 'Windy'],
  'General: Exterior Temperature': ['Above Freezing', 'Below Freezing'],

  // Section 2 - Orientation / Shutoffs
  'Electrical - Main Disconnect - Location': ['Front of the House', 'Rear of the House', 'Left Side of the House', 'Right Side of House', 'Garage', 'Garage Closet', 'Storage Closet', 'Laundry Room', 'Living Room', 'Hallway', 'Kitchen', 'Family Room', 'Master Bedroom', 'Additional Shutoff', 'Bedroom 1', 'Master Closet', 'Bedroom 2 Closet', 'Attic', 'Shop', 'Garage Storage', 'Bathroom', 'None'],
  'Gas - Main Shut Off Valve - Location': ['Meter', 'Propane Tank', 'Left Side of House', 'Right Side of House', 'Front of House', 'Rear of House', 'Near the Road', 'In the Back Yard', 'In the Front Yard'],
  'Water - Main Shut Off Valve - Location': ['Front Yard', 'Left Side of House', 'Right Side of House', 'Rear of House', 'Garage', 'Basement', 'Crawl Space', 'Laundry Room', 'Kitchen', 'Bathroom', 'Utility Room', 'At the Meter', 'At the Street', 'Unknown', 'Not Visible'],

  // Section 4 - Foundation & Structure
  'Foundation: Material': ['Concrete', 'Block', 'Brick', 'Stone', 'Wood', 'Steel', 'Combination'],
  'Foundation: Style': ['Slab on Grade', 'Crawl Space', 'Basement', 'Pier and Beam', 'Raised Foundation'],
  'Crawlspace: Floor Material': ['Dirt', 'Gravel', 'Concrete', 'Sand', 'None'],
  'Crawlspace: Soil Cover': ['Plastic Sheeting', 'None', 'Concrete', 'Gravel', 'Tarp', 'Partial Coverage'],
  'Floor Structure: Material': ['Wood Joists', 'Engineered I-Joists', 'Steel', 'Concrete', 'Truss', 'Open Web Steel Joists', 'Glulam Beams', 'LVL', 'PSL', 'Composite', 'Unknown', 'Not Accessible'],
  'Wall Structure: Material': ['Wood Studs', 'Steel Studs', 'Brick', 'Block', 'Stone', 'Concrete', 'Combination', 'Not Accessible'],
  'Ceiling Structure: Material': ['Wood Joists', 'Engineered I-Joists', 'Truss', 'Steel', 'Concrete', 'Not Accessible', 'Not Visible'],

  // Section 5 - Exterior
  'General: Inspection Method': ['Walked Grounds', 'From Ladder', 'From Street', 'From Driveway', 'Partial Walkthrough'],
  'Exterior Doors: Front': ['Wood', 'Steel', 'Fiberglass', 'Vinyl', 'Aluminum', 'Glass', 'French Door', 'Dutch Door', 'Screen Door', 'Storm Door', 'Sliding Glass', 'Double Door', 'Single Door', 'None'],
  'Exterior Doors: Rear': ['Wood', 'Steel', 'Fiberglass', 'Vinyl', 'Aluminum', 'Glass', 'French Door', 'Dutch Door', 'Screen Door', 'Storm Door', 'Sliding Glass', 'Double Door', 'Single Door', 'None'],
  'Exterior Doors: Garage': ['Wood', 'Steel', 'Fiberglass', 'Vinyl', 'Aluminum', 'Glass', 'Screen Door', 'Storm Door', 'Single Door', 'Double Door', 'Walk-through Door', 'Roll-up Door', 'None'],
  'Siding, Flashing & Trim: Wall Cladding Type': ['Vinyl', 'Wood', 'Fiber Cement', 'Brick', 'Stucco', 'Stone', 'Aluminum', 'Metal', 'EIFS', 'T1-11', 'Composite', 'Masonite', 'Cedar', 'Combination'],
  'Deck: Material': ['Wood', 'Composite', 'PVC', 'Aluminum', 'Concrete', 'None'],

  // Section 6 - Roof
  'General: Roof Type / Style': ['Gable', 'Hip', 'Flat', 'Gambrel', 'Mansard', 'Shed', 'Combination'],
  'Roof Structure & Attic: Structure Material': ['Wood Truss', 'Engineered Truss', 'Rafters', 'Steel', 'I-Joists', 'Not Visible'],
  'Roof Structure & Attic: Sheathing Material': ['Plywood', 'OSB', 'Skip Sheathing', 'Tongue & Groove', 'Boards', 'Metal', 'Not Visible', 'None Visible'],
  'Gutters: Material': ['Aluminum', 'Vinyl', 'Steel', 'Copper', 'None'],

  // Section 7 - Doors, Windows & Interior
  'Windows: Material': ['Vinyl', 'Wood', 'Aluminum', 'Fiberglass', 'Composite', 'Steel', 'Clad Wood', 'Single Pane', 'Double Pane', 'Triple Pane', 'Combination', 'Not Visible', 'Unknown'],
  'Floors: Floor Coverings': ['Hardwood', 'Laminate', 'Carpet', 'Tile', 'Vinyl', 'Linoleum', 'Concrete', 'Stone', 'Bamboo', 'Cork', 'Engineered Wood', 'LVP', 'LVT', 'Ceramic', 'Porcelain', 'Slate', 'Combination'],
  'Countertops & Cabinets: Countertop Material': ['Granite', 'Quartz', 'Marble', 'Laminate', 'Butcher Block', 'Tile', 'Concrete', 'Soapstone', 'Solid Surface', 'Stainless Steel', 'Wood', 'Corian', 'Formica', 'Composite', 'Not Present', 'Unknown'],
  'Countertops & Cabinets: Cabinetry Material': ['Wood', 'Laminate', 'MDF', 'Combination'],

  // Section 8 - Insulation & Ventilation
  'Attic Access: Access Type': ['Pull-down Stairs', 'Scuttle', 'Walk-up Stairs', 'Exterior Door', 'Multiple Access Points', 'None'],
  'Attic Access: Attic Accessible': ['Fully Accessible', 'Partially Accessible', 'Not Accessible', 'Access Too Small', 'No Access'],
  'Attic Insulation: Insulation Type': ['Fiberglass Batts', 'Blown-In Fiberglass', 'Blown-In Cellulose', 'Spray Foam', 'Rigid Foam', 'Rockwool', 'Mineral Wool', 'Vermiculite', 'Perlite', 'Cotton', 'Radiant Barrier', 'Reflective Insulation', 'None Visible', 'Combination', 'Unknown', 'Not Visible'],
  'Vapor Barrier/Retarder: Vapor Barrier Type': ['Plastic Sheeting', 'Kraft Paper', 'Foil Faced', 'Polyethylene', 'Housewrap', 'Paint', 'Spray Foam', 'None Visible', 'Not Visible', 'Unknown', 'Combination'],
  'Ventilation & Exhaust: Attic Ventilation Type': ['Ridge Vent', 'Gable Vent', 'Soffit Vent', 'Turbine', 'Power Fan', 'Combination', 'None Visible'],
  'Ventilation & Exhaust: Bathroom Ventilation Type': ['Exhaust Fan to Exterior', 'Exhaust Fan to Attic', 'Window Only', 'None'],
  'Ventilation & Exhaust: Kitchen Ventilation Type': ['Range Hood to Exterior', 'Range Hood Recirculating', 'Microwave Vent', 'None'],
  'Ventilation & Exhaust: Dryer Ventilation Termination': ['Exterior Wall', 'Roof', 'Attic', 'Crawl Space', 'None', 'Unknown'],

  // Section 9 - AC / Cooling
  'General: Location': ['Attic', 'Garage', 'Closet', 'Basement', 'Crawl Space', 'Exterior', 'Utility Room', 'Roof', 'Ground Level', 'Side of House', 'Rear of House', 'Multiple Locations', 'Unknown', 'Not Visible'],
  'General: Energy Source': ['Electric', 'Gas'],
  'General: Return air filter': ['Disposable', 'Washable', 'HEPA', 'Electronic', 'None'],
  'General: System Type': ['Central Air', 'Heat Pump', 'Mini-Split', 'Window Unit'],
  'General: HVAC Tonnage': ['1 Ton', '1.5 Ton', '2 Ton', '2.5 Ton', '3 Ton', '3.5 Ton', '4 Ton', '4.5 Ton', '5 Ton', '6 Ton', '7 Ton', '8 Ton', 'Unknown', 'Not Listed'],
  'Air Conditioning: Distribution System - Configuration': ['Ducted', 'Ductless', 'Both', 'Unknown'],
  'Air Conditioning: Distribution System - Ductwork': ['Metal', 'Flexible', 'Fiberglass', 'Fiberboard', 'PVC', 'Combination', 'Not Visible', 'Unknown'],
  'Manufacturer': ['Carrier', 'Trane', 'Lennox', 'Goodman', 'Rheem', 'York', 'American Standard', 'Bryant', 'Amana', 'Coleman', 'Heil', 'Payne', 'Frigidaire', 'GE', 'Whirlpool', 'LG', 'Samsung', 'Mitsubishi', 'Daikin', 'Fujitsu', 'Bosch', 'Ruud', 'Tempstar', 'Airtemp', 'Maytag', 'Nordyne', 'Gibson', 'Kelvinator', 'Luxaire', 'Ducane', 'Armstrong', 'Allied', 'Comfort-Aire', 'Airquest', 'Magic Chef', 'Other', 'Unknown', 'Not Visible'],

  // Section 10 - Furnace / Heater
  'Water Heater: Location': ['Garage', 'Basement', 'Utility Room', 'Closet', 'Attic', 'Crawl Space', 'Exterior', 'Laundry Room'],
  'Water Heater: Manufacturer': ['AO Smith', 'Rheem', 'Bradford White', 'GE', 'Whirlpool', 'State', 'American', 'Rinnai', 'Navien', 'Noritz', 'Takagi', 'Bosch', 'Other', 'Unknown'],
  'General: Power Source/Type': ['Natural Gas', 'Propane', 'Electric', 'Tankless Gas', 'Heat Pump'],
  'Capacity': ['20 Gallon', '30 Gallon', '40 Gallon', '50 Gallon', '60 Gallon', '75 Gallon', '80 Gallon', '100 Gallon', 'Tankless', 'On-Demand', 'Unknown', 'Not Listed', '18 Gallon', '28 Gallon', '38 Gallon', '55 Gallon', '65 Gallon', '85 Gallon', '120 Gallon', '2.5 Gallon', '6 Gallon'],

  // Section 12 - Electrical
  'Sub Panel: Type': ['Circuit Breaker', 'Fuses', 'Combination', 'Disconnect', 'Transfer Switch', 'Load Center', 'Unknown'],
  'Sub Panel: Location': ['Garage', 'Basement', 'Utility Room', 'Closet', 'Attic', 'Crawl Space', 'Exterior', 'Laundry Room', 'Kitchen', 'Bathroom', 'Hallway', 'Living Space', 'Mechanical Room', 'Furnace Room', 'Under Stairs', 'Pantry', 'Master Bedroom', 'Hall Closet', 'Entry Closet', 'Linen Closet', 'Storage Room', 'Carport', 'Patio', 'Porch', 'Multiple Locations', 'Workshop', 'Office', 'Bedroom', 'Dining Room', 'Family Room'],
  'Service Panel: Type': ['Circuit Breaker', 'Fuses', 'Combination'],
  'Service Panel: Amperage': ['60 Amp', '100 Amp', '125 Amp', '150 Amp', '200 Amp', '225 Amp', '300 Amp', '400 Amp', 'Unknown', 'Not Listed', '30 Amp', '50 Amp'],
  'Service Panel: Brand': ['Square D', 'General Electric', 'Siemens', 'Cutler-Hammer', 'Murray', 'ITE', 'Challenger', 'Federal Pacific', 'Zinsco', 'Pushmatic', 'Westinghouse', 'Eaton', 'Crouse-Hinds', 'Bryant', 'Bulldog', 'Sylvania', 'Connecticut Electric', 'Thomas & Betts', 'Wadsworth', 'Trumbull', 'Frank Adam', 'Gould', 'Split Bus', 'Other', 'Unknown', 'Not Visible', 'Homemade', 'Generic'],
  'Service Panel: Location': ['Garage', 'Basement', 'Utility Room', 'Closet', 'Attic', 'Crawl Space', 'Exterior', 'Laundry Room', 'Kitchen', 'Bathroom', 'Hallway', 'Living Space', 'Mechanical Room', 'Furnace Room', 'Under Stairs', 'Pantry', 'Master Bedroom', 'Hall Closet', 'Entry Closet', 'Linen Closet', 'Storage Room', 'Carport', 'Patio', 'Porch', 'Multiple Locations', 'Workshop', 'Office', 'Bedroom', 'Dining Room', 'Family Room'],
  'Branch Wiring Circuits & Breakers: Branch Wiring': ['Copper', 'Aluminum', 'Combination'],
  'Branch Wiring Circuits & Breakers: Sheathing': ['Romex', 'BX', 'MC Cable', 'Conduit'],
  'Service Entrance: Method': ['Overhead', 'Underground'],
  'Service Entrance: Material': ['Copper', 'Aluminum', 'Unknown'],
  'Service Panel: Manufacturer': ['Square D', 'General Electric', 'Siemens', 'Cutler-Hammer', 'Murray', 'ITE', 'Challenger', 'Federal Pacific', 'Zinsco', 'Pushmatic', 'Other', 'Unknown'],

  // Section 13 - Plumbing
  'General: Source of Water Supply': ['Public', 'Private Well', 'Cistern', 'Unknown', 'Community Well', 'Spring'],
  'Drain, Waste, & Vent Systems: Material': ['PVC', 'ABS', 'Cast Iron', 'Galvanized', 'Copper', 'Lead', 'Orangeburg', 'Clay', 'Concrete', 'PEX', 'Combination', 'Unknown'],
  'Water Supply: Water Supply Material': ['Copper', 'PEX', 'CPVC', 'Galvanized', 'PVC', 'Polybutylene', 'Lead', 'Combination'],

  // Section 14 - Fireplace & Chimney
  'General: Type': ['Wood Burning', 'Gas', 'Electric', 'Pellet', 'Ethanol', 'None'],

  // Section 15 - Built-In Appliances
  'Refrigerator: Brand': ['Whirlpool', 'GE', 'Samsung', 'LG', 'Frigidaire', 'KitchenAid', 'Maytag', 'Bosch', 'Sub-Zero', 'Other', 'Unknown'],
  'Dishwasher: Brand': ['Whirlpool', 'GE', 'Samsung', 'LG', 'Frigidaire', 'KitchenAid', 'Maytag', 'Bosch', 'Other', 'Unknown'],
  'Garbage Disposal: Brand': ['InSinkErator', 'Waste King', 'KitchenAid', 'Moen', 'GE', 'Other', 'Unknown', 'None'],
  'Microwave w/ Exhaust: Brand': ['GE', 'Whirlpool', 'Samsung', 'LG', 'Frigidaire', 'KitchenAid', 'Panasonic', 'Sharp', 'Other', 'Unknown'],
  'Microwave w/ Exhaust: Venting Method': ['Vented to Exterior', 'Recirculating', 'Unknown'],
  'Range Hood: Brand': ['Broan', 'GE', 'Whirlpool', 'Samsung', 'LG', 'KitchenAid', 'Bosch', 'Other', 'Unknown'],
  'Range Hood: Venting Method': ['Vented to Exterior', 'Recirculating', 'Unknown'],
  'Range/Oven/Cooktop: Brand': ['GE', 'Whirlpool', 'Samsung', 'LG', 'Frigidaire', 'KitchenAid', 'Bosch', 'Thermador', 'Other', 'Unknown'],
  'Range/Oven/Cooktop: Energy Source': ['Electric', 'Natural Gas', 'Propane', 'Dual Fuel'],

  // Section 16 - Garage
  'Floor: Material': ['Concrete', 'Epoxy', 'Sealed'],
  'Garage Door: Material': ['Steel', 'Wood', 'Aluminum', 'Fiberglass', 'Vinyl', 'Combination'],
  'Garage Door: Insulation': ['Insulated', 'Not Insulated'],
  'Garage Door: Operation': ['Manual', 'Automatic']
};

async function seedVercelProduction() {
  try {
    console.log('🚀 Starting VERCEL Production Database Seeding...\n');
    
    // Connect to VERCEL database
    await mongoose.connect(VERCEL_MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    const host = mongoose.connection.host;
    
    console.log('✅ Connected to MongoDB');
    console.log(`📍 Database: ${dbName}`);
    console.log(`🔗 Host: ${host}\n`);

    // Safety confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  This will seed the VERCEL PRODUCTION database. Continue? (yes/no):', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Seeding cancelled');
      process.exit(0);
    }

    let totalUpdated = 0;
    let totalSkipped = 0;

    // Process each item
    for (const [textField, choices] of Object.entries(answerChoicesMap)) {
      const item = await SectionChecklist.findOne({ text: textField });
      
      if (item) {
        await SectionChecklist.findByIdAndUpdate(
          item._id,
          { answer_choices: choices },
          { new: true }
        );
        console.log(`   ✅ Updated: ${textField} (${choices.length} choices)`);
        totalUpdated++;
      } else {
        console.log(`   ⚠️  Not found: ${textField}`);
        totalSkipped++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Items updated: ${totalUpdated}`);
    console.log(`⚠️  Items skipped: ${totalSkipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ VERCEL production database seeding complete!\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedVercelProduction();
