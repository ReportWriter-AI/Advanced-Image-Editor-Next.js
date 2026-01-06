//@ts-nocheck
import { IInspectionSection } from "../src/models/InspectionSection";

export const DEFAULT_INSPECTION_SECTIONS: Omit<IInspectionSection, "company" | "createdAt" | "updatedAt" | "_id">[] = [
  {
    "name": "Inspection Overview & Client Responsibilities",
    "order_index": 1,
    "checklists": [
      {
        "text": "Occupied Disclaimer",
        "type": "information",
        "order_index": 0,
        "comment": "The home was occupied, limiting access and visibility in some areas. As a result, not all outlets, windows, walls, floors, and covered countertops were inspected. I made every reasonable effort to access all areas, but recommend using your final walkthrough to verify that nothing was missed due to obstruction or inaccessibility.",
        "default_checked": false
      },
      {
        "text": "Inspection Details",
        "type": "status",
        "order_index": 1,
        "comment": "Inspection Categories & Summary Immediate Attention Major Defects: Issues that compromise the home’s structural integrity may result in additional damage if not repaired or are considered a safety hazard. These items are color-coded red in the report and should be corrected as soon as possible.Items for Repair Defects: Items in need of repair or correction, such as plumbing or electrical concerns, damaged or improperly installed components, etc. These are color-coded orange in the report and have no strict repair timeline.Maintenance Items\nSmall DIY-type repairs and maintenance recommendations are provided to increase knowledge of long-term care. While not urgent, addressing these will reduce future repair needs and costs.\n\nFurther Evaluation\nIn some cases, a defect falls outside the scope of a general home inspection or requires a more extensive level of knowledge to determine the full extent of the issue. These items should be further evaluated by a specialist.\n\nImportant Information & Limitations\nAGI Property Inspections performs all inspections in compliance with the Louisiana Standards of Practice. We inspect readily accessible, visually observable, permanently installed systems and components of the home. This inspection is not technically exhaustive or quantitative.\n\nSome comments may go beyond the minimum Standards as a courtesy to provide additional detail. Any item noted for repair, replacement, maintenance, or further evaluation should be reviewed by qualified, licensed tradespeople.\n\nThis inspection cannot predict future conditions or reveal hidden or latent defects. The report reflects the home’s condition only at the time of inspection. Weather, occupancy, or use may reveal issues not present at the time.\n\nThis report should be considered alongside the seller’s disclosure, pest inspection report, and contractor evaluations for a complete picture of the home’s condition.\n\nRepair Estimates Disclaimer\nThis report may include repair recommendations and estimated costs. These are based on typical labor and material rates in our region, generated from AI image review. They are approximate and not formal quotes.\n\nEstimates are not formal quotes. They do not account for unique site conditions and may vary depending on contractor, materials, and methods. Final pricing must always be obtained through qualified, licensed contractors with on-site evaluation. AGI Property Inspections does not guarantee the accuracy of estimates or assume responsibility for work performed by outside contractors.\n\nRecommendations\nContractors / Further Evaluation: Repairs noted should be performed by licensed professionals. Keep receipts for warranty and documentation purposes.\n\nCauses of Damage / Methods of Repair: Suggested repair methods are based on the inspector's experience and opinion. Final determination should always be made by licensed contractors.\n\nExcluded Items\nThe following are not included in this inspection: septic systems, security systems, irrigation systems, pools, hot tubs, wells, sheds, playgrounds, saunas, outdoor lighting, central vacuums, water filters, water softeners, sound or intercom systems, generators, sport courts, sea walls, outbuildings, operating skylights, awnings, exterior BBQ grills, and firepits.\n\nOccupied Home Disclaimer\nIf the home was occupied at the time of inspection, some areas may not have been accessible (furniture, personal belongings, etc.). Every effort was made to inspect all accessible areas; however, some issues may not have been visible.\n\nWe recommend using your final walkthrough to verify that no issues were missed and that the property remains in the same condition as at the time of inspection.",
        "default_checked": false
      }
    ]
  },
  {
    "name": "Inspection Details",
    "order_index": 2,
    "checklists": [
      {
        "text": "General: Style of Home",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Single-Family"
        ],
        "default_checked": false
      },
      {
        "text": "General: Utilities",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Electric",
          "Water",
          "Gas",
          "Propane",
          "All On",
          "All Off",
          "Water - Off",
          "Gas - Off"
        ],
        "default_checked": false
      },
      {
        "text": "General: In Attendance",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Client",
          "Buyer Agent",
          "Listing Agent",
          "Seller",
          "Tenant",
          "None",
          "Family of the Client",
          "Contractors",
          "Owner",
          "Agent Representative",
          "Owner Representative"
        ],
        "default_checked": false
      },
      {
        "text": "General: Occupancy",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Vacant",
          "Occupied",
          "Furnished",
          "Unfurnished",
          "Mostly Vacant",
          "Staged",
          "Partially Occupied",
          "Under Construction",
          "Remodeled",
          "New Construction"
        ]
      },
      {
        "text": "General: Weather",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Rain",
          "Recent Rain",
          "Clear",
          "Snow",
          "Recent snow",
          "Below freezing",
          "Cloudy",
          "Fog",
          "Heavy Rain",
          "Cold",
          "Windy"
        ],
        "default_checked": false
      },
      {
        "text": "General: Exterior Temperature",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Approximately 90 Degrees",
          "Approximately 65 Degrees"
        ]
      },
      {
        "text": "General: Type Of Inspection",
        "type": "status",
        "order_index": 6,
        "answer_choices": [
          "Pre-purchase",
          "Pre-Listing",
          "Warranty Inspection",
          "Warranty Expiration",
          "4-point",
          "Electrical",
          "Roof (only)",
          "New Build"
        ],
        "default_checked": false
      },
      {
        "text": "Occupied Disclaimer",
        "type": "information",
        "order_index": 8,
        "comment": "The home was occupied. This limited the visibility and access to all areas of the house. Therefore not all receptacles, windows, wall surfaces, floor surfaces, countertop areas, etc., were tested or inspected. I made every effort to get to all inaccessible areas. However, I recommend taking advantage of your final walkthrough to ensure I did not miss anything because it was covered or inaccessible."
      },
      {
        "text": "Inspection Categories & Summary",
        "type": "information",
        "order_index": 9,
        "comment": "Immediate Attention\nMajor defects are issues that can affect the home’s structural integrity, create safety concerns, or lead to further damage if not addressed. These items are marked in red in the report and should be evaluated and corrected as soon as possible.\n\nItems for Repair\nDefects are items that need repair or correction, such as plumbing or electrical issues or damaged or improperly installed components. These items are marked in orange in the report and do not have a strict repair timeline, but they should be addressed to help maintain the home’s condition and safety.\n\nMaintenance Items \nMaintenance items are small, DIY-type repairs and routine upkeep suggestions meant to help with long-term care of the home. They are not urgent, but taking care of them can help prevent future issues and reduce repair costs over time.\n\nFurther Evaluation\nSome issues fall outside the scope of a general home inspection or may require more specialized evaluation to determine the full extent of the problem. In those cases, I recommend further review by a qualified specialist.\n\nImportant Information & Limitations\nAGI Property Inspections follows the Louisiana Standards of Practice for every inspection. We evaluate the readily accessible, visibly observable, and permanently installed systems and components of the home. This is a visual inspection, not technically exhaustive or quantitative.\n\nThis inspection cannot predict future conditions or uncover hidden or latent defects. The report reflects the home’s condition only at the time of inspection, and changing weather, occupancy, or use may reveal issues that were not visible during the inspection. This report should be reviewed along with the seller’s disclosure, pest inspection, septic inspection, and any contractor evaluations to gain a full understanding of the property’s condition.\n\nRepair Estimates Disclaimer\nRepair recommendations and estimated costs in this report are provided as general guidance only. These figures are based on typical regional labor and material rates and may be generated through AI image review, which is limited to what is visible and may not fully reflect complex or hidden conditions. Estimates are not formal quotes and do not account for unique site factors. Final pricing must be obtained from qualified, licensed contractors after an on-site evaluation. AGI Property Inspections does not guarantee the accuracy of estimates or assume responsibility for work performed by outside contractors.\n\nRecommendations\nRepairs noted in this report should be completed by qualified, licensed professionals. Be sure to keep receipts and documentation for warranty and future reference.\n\nCauses of Damage / Methods of Repair \nSuggested repair methods are based on the inspector’s experience and professional opinion. Final repair decisions and methods should always be confirmed by qualified, licensed contractors.\n\nExcluded Items\nThe following are not included in this inspection: septic systems, security systems, irrigation systems, pools, hot tubs, wells, sheds, playgrounds, saunas, outdoor lighting, central vacuums, water filters, water softeners, sound or intercom systems, generators, sport courts, sea walls, outbuildings, operating skylights, awnings, exterior BBQ grills, and firepits.",
        "default_checked": false
      }
    ]
  },
  {
    "name": "Orientation / Shutoffs",
    "order_index": 3,
    "checklists": [
      {
        "text": "Electrical - Main Disconnect: Missing",
        "type": "information",
        "order_index": 0,
        "comment": "There wasn’t a main breaker installed."
      },
      {
        "text": "Rear of House",
        "type": "status",
        "order_index": 0
      },
      {
        "text": "Electrical - Main Disconnect: Unable to Inspect- Inaccessible",
        "type": "information",
        "order_index": 1,
        "comment": "The electrical main disconnect was not accessible due to occupants belongings."
      },
      {
        "text": "Left Side of House",
        "type": "status",
        "order_index": 1,
        "default_checked": false
      },
      {
        "text": "Electrical - Main Disconnect: Unable to Inspect - Locked",
        "type": "information",
        "order_index": 2,
        "comment": "The main electric panel was locked. I recommend having the lock removed so that the main breaker is accessible."
      },
      {
        "text": "Right Side of House",
        "type": "status",
        "order_index": 2
      },
      {
        "text": "Gas - Main Shut Off Valve: Unable to Locate- Ask Seller",
        "type": "information",
        "order_index": 3,
        "comment": "The main gas supply shut off valve could not be located. Ask the seller for all relevant information on gas supply system."
      },
      {
        "text": "Electrical - Main Disconnect - Location",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Front of the House",
          "Rear of the House",
          "Left Side of the House",
          "Right Side of House",
          "Garage",
          "Garage Closet",
          "Living Room",
          "Storage Closet",
          "Laundry Room",
          "Hallway",
          "Kitchen",
          "Family Room",
          "Master Bedroom",
          "Additional Shutoff",
          "Bedroom 1",
          "Master Closet",
          "Bedroom 2 Closet",
          "Attic",
          "Shop",
          "Garage Storage",
          "Bathroom",
          "None"
        ]
      },
      {
        "text": "Gas - Main Shut Off Valve - Location",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Meter",
          "Propane Tank",
          "Left Side of House",
          "Right Side of House",
          "Front of House",
          "Rear of House",
          "Near the Road",
          "In the Front Yard"
        ]
      },
      {
        "text": "Water - Main Shut Off Valve: Main Water Shut Off - Inaccessible",
        "type": "information",
        "order_index": 4,
        "comment": "The main water shut off is not accessible. It is likely in the locked mechanical room for the building."
      },
      {
        "text": "Water - Main Shut Off Valve: Location",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Front Yard"
        ]
      },
      {
        "text": "Water - Main Shut Off Valve: Main Water Shut-Off Valve - Unable to Locate",
        "type": "information",
        "order_index": 5,
        "comment": "I was unable to locate the main water shut off valve during the inspection. I recommend asking the sellers about it’s location, if they don’t know where it is then I recommend having a licensed plumber locate it or install one."
      },
      {
        "text": "Main Shutoffs: Why Your Main Shutoff Locations Are Important",
        "type": "information",
        "order_index": 10,
        "comment": "I recommend that everyone familiarizes themselves with the location of all main shutoffs; electric, water, and gas (if applicable).The electrical service panel provides power to the whole house, and that power can be turned off with the main breaker. Knowing the panel's location and that main breaker may benefit all family members. This is where you would reset a tripped breaker or cut off the power in the event of an emergency.Knowing where the main water shut-off is can help minimize water damage and avoid costly repairs if there's a plumbing emergency. There should be a main shutoff located on the property that is accessible at all times, and if I was able to find it, its location will be provided in this section. Sometimes it's buried or under brush and is hard to see. Like with other shutoffs, it's essential to know where the main gas shutoff is. It's typically located at the gas meter or at the propane tank if propane is the gas supply. Some homeowners like to set their main water and gas shutoffs to the off position. So if you are turning it off at the main as a proactive solution to a leak or issue that comes up while you are away from home for an extended period, that's ok. However, if you are home and ever feel like you have a gas leak, don't go to the shutoff and try to turn the gas off. Leave the property and call the local utility company, and they will send someone right out.I have done my best to find the locations of all of these shutoffs for you and listed them in this section, with a picture and a location tag."
      }
    ]
  },
  {
    "name": "Grounds",
    "order_index": 4,
    "checklists": [
      {
        "text": "General: Grounds Inspection Limitation",
        "type": "information",
        "order_index": 1,
        "comment": "The grounds inspection includes exterior features that are not part of the structure, such as landscape beds, driveways, patios, and yard grading. These areas are reviewed because they can directly affect the home. Items outside of these parameters are not included in the grounds inspection.",
        "default_checked": false
      },
      {
        "text": "General: Grading/Lot Limitations",
        "type": "information",
        "order_index": 2,
        "comment": "The performance of lot drainage and grading is based on conditions observed at the time of the inspection. I cannot confirm how these areas perform under different weather conditions, as conditions can change. Heavy rain or other weather events may reveal issues not visible during the inspection. I recommend asking the sellers about any history of flooding or water intrusion.",
        "default_checked": false
      },
      {
        "text": "General: Inspection Limitation - Occupant Belongings",
        "type": "information",
        "order_index": 3,
        "comment": "Some areas were visibly obstructed and needed to be thoroughly inspected once obstructions were removed."
      },
      {
        "text": "General: Inspection Limitation - Access/Visibility",
        "type": "information",
        "order_index": 4,
        "comment": "One or more areas of the grounds are excluded from this inspection due to a lack of access/visibility."
      },
      {
        "text": "General: Inspection Limitation - Debris",
        "type": "information",
        "order_index": 5,
        "comment": "The deck was covered with debris and therefore could not be thoroughly inspected."
      },
      {
        "text": "General: Exterior Siding - Blocked by Vegetation",
        "type": "information",
        "order_index": 6,
        "comment": "Areas of the exterior siding or covered with vegetation. Therefore these areas could not be visually inspected for damage."
      }
    ]
  },
  {
    "name": "Foundation & Structure",
    "order_index": 5,
    "checklists": [
      {
        "text": "Floor Structure - Inaccessible",
        "type": "information",
        "order_index": 0,
        "comment": "The floor structure was covered by finished surfaces and could not be visually inspected. Only accessible and visible areas were reviewed, and any issues found are noted in this report.",
        "default_checked": true
      },
      {
        "text": "Foundation: Material",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Block",
          "Slab on Grade",
          "Brick",
          "Wood",
          "Stone",
          "Combination",
          "Steel",
          "Concrete"
        ],
        "default_checked": true,
        "default_selected_answers": [
          "Block",
          "Brick"
        ]
      },
      {
        "text": "Wall Structure - Inaccessible",
        "type": "information",
        "order_index": 1,
        "comment": "The wall structure was covered by finished surfaces and could not be visually inspected. Only accessible and visible areas were reviewed, and any issues found are noted in this report.",
        "default_checked": true
      },
      {
        "text": "Wall Structure: Material",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Wood Studs",
          "Steel Studs",
          "Stone",
          "Brick",
          "Block",
          "Concrete",
          "Combination",
          "Not Accessible",
          "Typically Wood (Inaccessible)",
          "Inaccessible"
        ],
        "default_checked": true
      },
      {
        "text": "Celling Structure",
        "type": "information",
        "order_index": 2,
        "comment": "Most of the ceiling structure wasn’t accessible due to finished surfaces. I inspected all visible areas, and any issues found are documented in this report.",
        "default_checked": true
      },
      {
        "text": "Floor Structure: Material",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Wood Joists",
          "Engineered I-Joists",
          "Concrete",
          "Steel",
          "Truss",
          "Open Web Steel Joists",
          "Glulam Beams",
          "LVL",
          "PSL",
          "Composite",
          "Unknown",
          "Not Accessible"
        ]
      },
      {
        "text": "Foundation/Crawlspace/Structural Limitations",
        "type": "information",
        "order_index": 3,
        "comment": "The flooring and wall structural materials were covered by finished surfaces and were not visible for inspection. Only accessible and visible areas were reviewed, and any issues found are noted in this report.",
        "default_checked": false
      },
      {
        "text": "General: Foundation Inspection Limitation - Vegetation",
        "type": "information",
        "order_index": 4,
        "comment": "The vegetation was blocking areas of the visible slab. Every effort was made to look behind it, but there could be hidden issues that weren’t visible."
      },
      {
        "text": "Crawlspace: Floor Material",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Dirt",
          "Gravel",
          "Concrete",
          "Sand",
          "None"
        ]
      },
      {
        "text": "Foundation: Style",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Slab on Grade",
          "Crawl Space",
          "Basement",
          "Pier and Beam",
          "Raised Foundation"
        ]
      },
      {
        "text": "General: Crawlspace Inspection Limitation - Unsafe Conditions",
        "type": "information",
        "order_index": 5,
        "comment": "Crawlspace conditions posed a personal safety hazard and were inspected from an exterior vantage point. There were areas of the crawlspace that were not visible and could not be thoroughly inspected. Every effort is made to see and rule out major decencies but some minor defects may not have been visible.",
        "default_checked": true
      },
      {
        "text": "Crawlspace: Soil Cover",
        "type": "information",
        "order_index": 6,
        "comment": "The General Home Inspection includes inspection of the home structural elements that were readily visible at the time of the inspection. This typically includes the foundation, exterior walls, floor structures and roof structure. Much of the home structure is hidden behind exterior and interior roof, floor, wall, and ceiling coverings, or is buried underground. Because the General Home Inspection is limited to visual and non-invasive methods, this report may not identify all deficiencies.",
        "answer_choices": [
          "Plastic Sheeting",
          "None",
          "Concrete",
          "Gravel",
          "Tarp",
          "Partial Coverage"
        ]
      },
      {
        "text": "General: Crawlspace Inspection Limitation - Debris Obstruction",
        "type": "information",
        "order_index": 6,
        "comment": "Due to debris accumulation, some crawlspace areas were inspected from an exterior vantage point (at the outer walls). This limits the inspection."
      },
      {
        "text": "Soil Cover",
        "type": "status",
        "order_index": 6
      },
      {
        "text": "General: Crawlspace Inspection Limitation - No Access",
        "type": "information",
        "order_index": 7,
        "comment": "The crawlspace was completely closed on all sides and therefore only inspected from a very limited vantage point (at the house's outer walls and through any visible openings)."
      },
      {
        "text": "General: Foundation Inspection Limitation - Sealed Crawlspace",
        "type": "information",
        "order_index": 8,
        "comment": "The crawlspace was completely closed on all sides and therefore not visually inspected. I did not find any indication that there were any major defects under there. However, there are almost always some minor defects. If this concerns you, have the sellers make the crawlspace accessible and have a foundation specialist determine if any repairs are needed."
      },
      {
        "text": "General: Crawlspace Inspection",
        "type": "information",
        "order_index": 20,
        "comment": "The majority of the crawlspace was not inspected, as it was not a partof the inspection. Items noted in the report from the crawlspace were specifically pointed out and noted in the report."
      }
    ]
  },
  {
    "name": "Exterior",
    "order_index": 6,
    "checklists": [
      {
        "text": "Exterior: Inspection Method",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Visual"
        ],
        "default_checked": true
      },
      {
        "text": "General: Inspection Method",
        "type": "information",
        "order_index": 1,
        "comment": "The exterior door was locked and could not be thoroughly inspected.",
        "answer_choices": [
          "From Ground",
          "From Ladder",
          "Walked on Roof",
          "From Drone",
          "Binoculars",
          "From Attic",
          "From Window",
          "Partial Access",
          "Limited View",
          "Not Accessible"
        ]
      },
      {
        "text": "General: Exterior Inspection Limitation - Pets",
        "type": "information",
        "order_index": 1,
        "comment": "The home was occupied, and some areas couldn’t be seen or inspected thoroughly due to the occupant's belongings."
      },
      {
        "text": "Exterior Doors: Front of House",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Wood/Glass Combination",
          "Metal",
          "Fiberglas",
          "Metal/Glass Combination",
          "Fiberglass/Glass Combination",
          "Storm Door",
          "Screen Door",
          "Wood"
        ],
        "default_checked": false
      },
      {
        "text": "General: Exterior Inspection Limitation - Condo",
        "type": "information",
        "order_index": 2,
        "comment": "The exterior door was blocked and could not be thoroughly inspected for functionality."
      },
      {
        "text": "Exterior Doors: Rear of House",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Wood",
          "Wood/Glass Combination",
          "Metal",
          "Metal/Glass Combination",
          "Fiberglass",
          "Fiberglass/Glass Combination",
          "Storm Door",
          "Screen Door",
          "Sliding / Glass"
        ]
      },
      {
        "text": "General: Exterior Inspection Limitation - Neighbors Gate",
        "type": "information",
        "order_index": 3,
        "comment": "Giving the type of material used at the exterior door and siding are for informational use only. It is not always possible to tell what type of material was used in manufacturing."
      },
      {
        "text": "Exterior Doors: Garage Entry",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Wood",
          "Wood/Glass Combination",
          "Metal",
          "Metal/Glass Combination",
          "Fiberglass",
          "Fiberglass/Glass Commination",
          "Storm Door",
          "Screen Door"
        ]
      },
      {
        "text": "Exterior Doors: Front",
        "type": "information",
        "order_index": 4,
        "comment": "The exterior and roof of condominium buildings are not fully inspected during a home inspection. I recommend asking the management about the process for addressing issues that arise on the exterior or roof.",
        "answer_choices": [
          "Wood",
          "Steel",
          "Fiberglass",
          "Vinyl",
          "Aluminum",
          "Glass",
          "French Door",
          "Dutch Door",
          "Screen Door",
          "Storm Door",
          "Sliding Glass",
          "Double Door",
          "Single Door",
          "None"
        ]
      },
      {
        "text": "General: Exterior Inspection Limitation - Vegetation",
        "type": "information",
        "order_index": 4,
        "comment": "Due to windows being covered, some areas were not visible at the time of inspection and therefore could not be thoroughly inspected."
      },
      {
        "text": "Exterior Doors: Carport Entry",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Wood",
          "Wood/Glass Combination",
          "Metal",
          "Metal/Glass Combination",
          "Fiberglass",
          "Fiberglass/Glass Combination",
          "Storm Door",
          "Screen Door"
        ]
      },
      {
        "text": "Exterior Doors: Rear",
        "type": "information",
        "order_index": 5,
        "comment": "I was unable to access and inspect areas of the home. The only access was through the neighbor's gate, which was locked at the time of the inspection.",
        "answer_choices": [
          "Wood",
          "Steel",
          "Fiberglass",
          "Vinyl",
          "Aluminum",
          "Glass",
          "French Door",
          "Dutch Door",
          "Screen Door",
          "Storm Door",
          "Sliding Glass",
          "Double Door",
          "Single Door",
          "None"
        ]
      },
      {
        "text": "Siding, Flashing & Trim: Wall Cladding Type",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Brick Veneer",
          "Fiber Cement",
          "Vinyl",
          "EIFS",
          "Wood",
          "Stucco",
          "Stone",
          "Aluminum",
          "Metal",
          "T1-11",
          "Composite",
          "Masonite",
          "Cedar",
          "Combination"
        ]
      },
      {
        "text": "General: Exterior Inspection Limitation - Owner's Belongings",
        "type": "information",
        "order_index": 5,
        "comment": "The exterior siding appeared to be asbestos-containing material. However, to confirm, it must be lab-tested, which is beyond the scope of this inspection."
      },
      {
        "text": "Exterior Doors: Garage",
        "type": "information",
        "order_index": 6,
        "comment": "Some exterior areas were blocked by vegetation and were not visible for inspection. Every effort was made to look through and around the vegetation in order to be as thorough as possible.",
        "answer_choices": [
          "Wood",
          "Steel",
          "Fiberglass",
          "Vinyl",
          "Aluminum",
          "Glass",
          "Screen Door",
          "Storm Door",
          "Single Door",
          "Double Door",
          "Walk-through Door",
          "Roll-up Door",
          "None"
        ]
      },
      {
        "text": "General: Exterior Door Inspection Limitation - Blocked",
        "type": "information",
        "order_index": 6,
        "comment": "The deck was enclosed on all sides and the underneath could not be visually inspected."
      },
      {
        "text": "Exterior Support Columns: Material",
        "type": "status",
        "order_index": 6,
        "answer_choices": [
          "Wood",
          "Brick"
        ]
      },
      {
        "text": "General: Exterior Window Inspection Limitation - Visibility",
        "type": "information",
        "order_index": 7,
        "comment": "This area could only be viewed from a distance. There was a wasp nest with lots of wasp flying around. I recommend checking these things once they’ve been cleared."
      },
      {
        "text": "Deck: Material",
        "type": "status",
        "order_index": 7,
        "answer_choices": [
          "Wood",
          "Composite",
          "PVC",
          "Aluminum",
          "Concrete",
          "None"
        ]
      },
      {
        "text": "General: Deck Inspection Limitation",
        "type": "information",
        "order_index": 8
      },
      {
        "text": "General: Inaccessible - Pests",
        "type": "information",
        "order_index": 9
      },
      {
        "text": "General: Exterior Siding - Possible Asbestos",
        "type": "information",
        "order_index": 27
      }
    ]
  },
  {
    "name": "Roof",
    "order_index": 7,
    "checklists": [
      {
        "text": "General: Roofing Limitations",
        "type": "information",
        "order_index": 0,
        "comment": "Due to the steep pitch of the roof, some areas could not be safely walked. Those sections were inspected from the ground with binoculars or from a ladder at a distance. Some conditions may not have been visible from those vantage points.",
        "default_checked": true
      },
      {
        "text": "Coverings: Material",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Architectural Shingles",
          "Metal",
          "Bitumen",
          "3-Tab Asphalt Shingles",
          "Asphalt Roll"
        ]
      },
      {
        "text": "General: Roof Inspection Limitation - Height",
        "type": "information",
        "order_index": 1,
        "comment": "Due to the occupants belongings preventing access to the attic, areas of the attic and roof structure could not inspected."
      },
      {
        "text": "Roof Structure & Attic: Material",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Wood",
          "Rafters",
          "Wood Truss",
          "Engineered Truss",
          "Steel",
          "I-Joists",
          "Not Visible",
          "Conventional Framing"
        ],
        "default_checked": false
      },
      {
        "text": "General: Inspection Method",
        "type": "information",
        "order_index": 1,
        "comment": "Areas of the roof and attic could not be accessed and were viewed from a limited vantage point, which could make some minor issues hard to see. I make every effort to view all areas as closely as possible to rule out as many major damage issues as possible.",
        "answer_choices": [
          "Binoculars",
          "Ground",
          "Ladder",
          "Roof",
          "Drone",
          "Not accessible",
          "Lower Roof",
          "Walked Roof",
          "Camera Pole",
          "Ground / Binoculars"
        ]
      },
      {
        "text": "General: Roof Type / Style",
        "type": "information",
        "order_index": 2,
        "comment": "Due to the height of the roof surface, it was not walked on. It was viewed from a limited vantage point from the ground with binoculars and a camera pole. As a result, some minor defects may not have been visible.",
        "answer_choices": [
          "Gable",
          "Hip",
          "Flat",
          "Gambrel",
          "Mansard",
          "Shed",
          "Combination"
        ]
      },
      {
        "text": "Gutters: Material",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Aluminum",
          "Vinyl",
          "Steel",
          "Copper",
          "None"
        ]
      },
      {
        "text": "General: Roof Structure Inspection Limitation - Occupants Belongings",
        "type": "information",
        "order_index": 3,
        "comment": "I was unable to inspect the roof structure, attic and ventilation systems due to the attic access being sealed."
      },
      {
        "text": "General: Roof Inspection Limitation - Safety",
        "type": "information",
        "order_index": 4,
        "comment": "The roof was not safe to walk during the inspection because it was raining. Therefore, the roof was inspected from a limited vantage point by other means; drone, camera pole, binoculars, ladder. There could be defects that weren’t visible."
      },
      {
        "text": "General: Roof Inspection Limitation - Covered",
        "type": "information",
        "order_index": 5,
        "comment": "Areas of the attic were inaccessible due to a lack of decking. Those areas were viewed from a safe, distant vantage point and every effort was made to find any defects. Some minor defects may not have been visible."
      },
      {
        "text": "General: Attic Inspection Limitation - Sealed Access Panel",
        "type": "information",
        "order_index": 6,
        "comment": "The roof framing and decking was covered with spray foam insulation. Therefore, there may be some defects that were not visible at the time of the inspection."
      },
      {
        "text": "General: Roof Inspection Limitation - Raining",
        "type": "information",
        "order_index": 7,
        "comment": "The attic sheathing was covered and therefore not visible for inspection. There did not appear to be any ongoing issues."
      },
      {
        "text": "General: Roof Structure Inspection Limitation - No Walkway",
        "type": "information",
        "order_index": 8,
        "comment": "The home did not have a sufficient roof drainage system installed to channel roof drainage away from the foundation. This condition can result in excessively high moisture levels in soil at the foundation. Excessively high moisture levels in soil near the foundation can reduce the ability of the soil to support the weight of the home structure. The Inspector recommends installation of a roof drainage system to discharge roof drainage away from soil near the foundation."
      },
      {
        "text": "General: Roof Structure Inspection Limitation - Spray Foam Insulation",
        "type": "information",
        "order_index": 9,
        "comment": "The roof framing could not be visually inspected, because there was no attic access."
      },
      {
        "text": "Roof Structure & Attic: Sheathing Material",
        "type": "information",
        "order_index": 9,
        "comment": "There is no attic access in the home. Modular/manufactured homes typically do not have an attic access therefore the roof structure and attic were not inspected.",
        "answer_choices": [
          "Plywood",
          "OSB",
          "Skip Sheathing",
          "Tongue & Groove",
          "Boards",
          "Metal",
          "Not Visible",
          "None Visible"
        ]
      },
      {
        "text": "General: Roof Structure Inspection Limitation - Covered",
        "type": "information",
        "order_index": 10,
        "comment": "The home's roof framing and structural material were covered with spray foam insulation and could not be visually inspected."
      },
      {
        "text": "General: Attic - Inaccessible",
        "type": "information",
        "order_index": 11,
        "comment": "The aluminum gutter system was a seamless type with gutter seams at corners only. Seams are weak points in gutters and are typically where they fail first. Gutter systems using seamless fabrication may have longer service lives than gutters assembled in sections."
      },
      {
        "text": "Roof Structure & Attic: Roof Inspection Limitation - Spray Foam",
        "type": "information",
        "order_index": 12,
        "comment": "The home had gutters and downspouts made from vinyl. Vinyl gutter systems are more fragile and have short service lives compared to systems fabricated from metal."
      },
      {
        "text": "General: Modular/Manufactured Home - No Attic Access",
        "type": "information",
        "order_index": 14,
        "comment": "The roof had areas that were not safe to walk. Therefore, those areas were inspected from a limited vantage point using other means; drone, camera pole, binoculars, ladder. There could be defects that weren’t visible."
      },
      {
        "text": "General: Gutters - Recommended",
        "type": "information",
        "order_index": 24,
        "comment": "The home had gutters and downspouts made from copper. Properly installed copper gutter systems have the longest service life of any commonly-used material and are generally considered to be high-quality."
      },
      {
        "text": "Gutters: Copper",
        "type": "information",
        "order_index": 27
      },
      {
        "text": "Gutters: Seamless Aluminum",
        "type": "information",
        "order_index": 28
      },
      {
        "text": "Gutters: Vinyl",
        "type": "information",
        "order_index": 29
      }
    ]
  },
  {
    "name": "Doors, Windows & Interior",
    "order_index": 8,
    "checklists": [
      {
        "text": "Windows: Material",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Vinyl",
          "Double Pane",
          "Aluminum",
          "Single Pane",
          "Wood",
          "Fiberglass",
          "Composite",
          "Steel",
          "Clad Wood",
          "Triple Pane",
          "Combination",
          "Not Visible",
          "Unknown"
        ]
      },
      {
        "text": "Window - Covered / Blocked",
        "type": "information",
        "order_index": 0,
        "comment": "The window was covered and could not be thoroughly inspected.",
        "default_checked": false
      },
      {
        "text": "Door Inspection Limitation - Locked",
        "type": "information",
        "order_index": 1,
        "comment": "Door was locked and inoperable and therefore not inspected.",
        "default_checked": false
      },
      {
        "text": "Floors: Floor Coverings",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Linoleum Vinyl Plank",
          "Linoleum Vinyl Tile",
          "Laminate",
          "Tile",
          "Hardwood",
          "Carpet",
          "Vinyl",
          "Linoleum",
          "Concrete",
          "Engineered Wood"
        ],
        "default_checked": false
      },
      {
        "text": "Window Inspection Limitation - Locked",
        "type": "information",
        "order_index": 2,
        "comment": "The window had a lock in place preventing the window from opening.",
        "default_checked": false
      },
      {
        "text": "Walls: Wall Material",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Drywall",
          "Paneling"
        ]
      },
      {
        "text": "Ceilings: Ceiling Material",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Wood",
          "Drywall"
        ]
      },
      {
        "text": "Window Inspection Limitation - Crank Missing",
        "type": "information",
        "order_index": 3,
        "comment": "The window crank was missing and needs to be replaced.",
        "default_checked": false
      },
      {
        "text": "Countertops: Material",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Stone",
          "Wood"
        ]
      },
      {
        "text": "Cabinet: Material",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Wood"
        ]
      },
      {
        "text": "Countertops & Cabinets: Countertop Material",
        "type": "information",
        "order_index": 14,
        "answer_choices": [
          "Granite",
          "Quartz",
          "Marble",
          "Laminate",
          "Butcher Block",
          "Tile",
          "Concrete",
          "Soapstone",
          "Solid Surface",
          "Stainless Steel",
          "Wood",
          "Corian",
          "Formica",
          "Composite",
          "Not Present",
          "Unknown"
        ]
      },
      {
        "text": "Countertops & Cabinets: Cabinetry Material",
        "type": "information",
        "order_index": 15,
        "answer_choices": [
          "Wood",
          "Laminate",
          "MDF",
          "Combination"
        ]
      }
    ]
  },
  {
    "name": "Insulation & Ventilation",
    "order_index": 9,
    "checklists": [
      {
        "text": "Attic Access: Type",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Pull-Down Stairs",
          "Scuttle",
          "Door",
          "None - Inaccessible",
          "None - Manufactured Home"
        ]
      },
      {
        "text": "Attic Access: Accessible",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Yes - Limited Access",
          "No - Inaccessible"
        ],
        "default_checked": false
      },
      {
        "text": "Attic Access: Access Type",
        "type": "information",
        "order_index": 2,
        "comment": "There were areas of the attic that were not accessible and had to be viewed from a limited vantage point. I give my best effort to access and/or view all areas of the attic to rule out as many defects. As possible. However, some minor defects may not have been visible.",
        "answer_choices": [
          "Pull-down Stairs",
          "Scuttle",
          "Walk-up Stairs",
          "Exterior Door",
          "Multiple Access Points",
          "None"
        ]
      },
      {
        "text": "Insulation Type",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Fiberglass Batts",
          "Blown-In Fiberglass",
          "Blown-In Cellulose",
          "Spray Foam",
          "Rigid Foam",
          "Rockwool",
          "Mineral Wool",
          "Vermiculite",
          "Perlite",
          "Cotton",
          "Radiant Barrier",
          "Reflective Insulation",
          "None Visible",
          "Combination",
          "Unknown",
          "Not Visible"
        ],
        "default_checked": false
      },
      {
        "text": "Attic Ventilation Type",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Ridge Vent",
          "Gable Vent",
          "Soffit Vent",
          "Turbine",
          "Power Fan",
          "Combination",
          "None Visible"
        ],
        "default_checked": false
      },
      {
        "text": "Attic Access: Attic Accessible",
        "type": "information",
        "order_index": 3,
        "comment": "The access hatch to the attic was too small to provide safe entry and exit. As a result, inspection of the attic space was done from a limited vantage point. However, the space was insulated and there were no visible signs of damage to the roof framing.",
        "answer_choices": [
          "Fully Accessible",
          "Partially Accessible",
          "Not Accessible",
          "Access Too Small",
          "No Access"
        ]
      },
      {
        "text": "Bathroom Ventilation Type",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Exhaust Fan to Exterior",
          "Exhaust Fan to Attic",
          "Window Only",
          "None"
        ],
        "default_checked": false
      },
      {
        "text": "Kitchen Ventilation Type",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Range Hood to Exterior",
          "Range Hood to Attic",
          "Recirculating Range Hood",
          "Microwave to Exterior",
          "Microwave to Attic",
          "Recirculating Microwave Exhaust"
        ],
        "default_checked": false
      },
      {
        "text": "Dryer Ventilation Termination",
        "type": "status",
        "order_index": 6,
        "answer_choices": [
          "Exterior Wall",
          "Roof",
          "Attic",
          "Crawl Space",
          "None",
          "Unknown"
        ],
        "default_checked": false
      },
      {
        "text": "Vapor Barrier/Retarder: Vapor Barrier Type",
        "type": "information",
        "order_index": 7,
        "comment": "The attic access was blocked by the occupant's belongings. The Inspector recommends that the attic be inspected after access to the attic entry hatch has been provided.",
        "answer_choices": [
          "Plastic Sheeting",
          "Kraft Paper",
          "Foil Faced",
          "Polyethylene",
          "Housewrap",
          "Paint",
          "Spray Foam",
          "None Visible",
          "Not Visible",
          "Unknown",
          "Combination"
        ]
      },
      {
        "text": "Ventilation & Exhaust : Bathroom Ventilation Type",
        "type": "information",
        "order_index": 8,
        "comment": "There was no attic access, and therefore the insulation and ventilation could not be visually inspected."
      },
      {
        "text": "Ventilation & Exhaust : Kitchen Ventilation Type",
        "type": "information",
        "order_index": 9,
        "comment": "No access hatch was provided through which to view roof framing. The roof framing was not visually inspected. I recommend having an attic access provided and the attic inspected."
      },
      {
        "text": "Ventilation & Exhaust : Dryer Ventilation Termination",
        "type": "information",
        "order_index": 10,
        "comment": "No light was provided in the attic. All areas that are used for storage or that have equipment that requires maintenance, there should have been at least one light and the switch should be located near the attic entrance."
      },
      {
        "text": "General: Attic Limitations",
        "type": "information",
        "order_index": 11,
        "comment": "There was no decking or walkways in areas of the attic. There were only open rafters and unsafe to traverse. Some areas of the attic had to be viewed from a distance and therefore, some minor defects may not have been visible.",
        "default_checked": true
      },
      {
        "text": "General: Attic Inspection Limitation- Access too Small",
        "type": "information",
        "order_index": 12,
        "comment": "Some areas of the attic could not be inspected due to scuttle being inoperable."
      },
      {
        "text": "General: Attic Inspection Limitation - Access Blocked",
        "type": "information",
        "order_index": 13,
        "comment": "There was a built up section of the roof. There wasn’t a safe way to access this area and therefore could not thoroughly inspect the area."
      },
      {
        "text": "General: Attic Inspection Limitation - No Access",
        "type": "information",
        "order_index": 14,
        "comment": "There wasn’t any access to the attic space except for through the ceiling tiles. This limited the inspection vantage point and some defects may not have been visible."
      },
      {
        "text": "General: Attic Inspection Limitation- No Access",
        "type": "information",
        "order_index": 15,
        "comment": "The attic did not have a vapor barrier installed. Typically we only see vapor barriers when fiberglass batt insulation is used."
      },
      {
        "text": "General: Attic Inspection Limitation - No Light",
        "type": "information",
        "order_index": 16,
        "comment": "Proper ventilation in your attic helps address excess heat and moisture that can otherwise wreak havoc on your home. Heat and moisture buildup in an attic cause predictable but different problems in hot and cold climates; areas with hot summers and cold winters can suffer the effects of both."
      },
      {
        "text": "General: Attic Inspection Limitation- No Walkway",
        "type": "information",
        "order_index": 17,
        "comment": "There was no attic access at the time of the inspection. Therefore inspecting the soffit vents from the interior of the roofing structure was not possible."
      },
      {
        "text": "General: Attic Access Limitation- Scuttle Secured/Locked",
        "type": "information",
        "order_index": 18
      },
      {
        "text": "General: Attic Access Limitation - Elevated Section",
        "type": "information",
        "order_index": 19
      },
      {
        "text": "General: Attic Inspection Limitation - Drop Ceiling",
        "type": "information",
        "order_index": 20
      },
      {
        "text": "General: Vapor Barrier - Not Present",
        "type": "information",
        "order_index": 21
      },
      {
        "text": "Ventilation & Exhaust : Attic Ventilation Type",
        "type": "information",
        "order_index": 22
      },
      {
        "text": "Ventilation & Exhaust : Ventilation Inspection Limitation - No Access",
        "type": "information",
        "order_index": 23
      }
    ]
  },
  {
    "name": "AC / Cooling",
    "order_index": 10,
    "checklists": [
      {
        "text": "Manufacturer",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Amana",
          "Arcoaire",
          "Bryant",
          "Carrier",
          "Daikin",
          "Frigidaire",
          "Goodman",
          "General Electric",
          "Payne",
          "Maytag",
          "Rheem",
          "Ruud",
          "Tempstar",
          "Weather King"
        ],
        "default_checked": false
      },
      {
        "text": "AC Temperature Differential",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Less than 15 Degree Differential (Inadequate)",
          "15-24 Degree Differential (Recommended)",
          "Above 24 Degree Differential (Imbalanced)"
        ],
        "default_checked": false
      },
      {
        "text": "General: Data Tag - Missing",
        "type": "information",
        "order_index": 1,
        "comment": "The data tag for the condenser was not present on the equipment."
      },
      {
        "text": "System Data Plate",
        "type": "status",
        "order_index": 2,
        "default_checked": false
      },
      {
        "text": "Location",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Attic",
          "Left Side of House",
          "Right Side of House",
          "Rear of House",
          "HVAC Closet",
          "Rear of Building",
          "Rear of Shop",
          "Utility Room",
          "Shop",
          "Roof"
        ],
        "default_checked": false
      },
      {
        "text": "Energy Source",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Electric"
        ],
        "default_checked": true
      },
      {
        "text": "Air Conditioning: Return air filter",
        "type": "information",
        "order_index": 5,
        "comment": "This inspection excludes the inspection of humidifiers, dehumidifiers, electric air filters, thermostat precision, timed functions, concealed cooling components, life expectancy, and safety devices. Moreover, the inspection does not verify coolant levels or system cleanliness, including drain lines. If the HVAC system is not new, it is recommended to have a qualified HVAC professional thoroughly clean and service the system."
      },
      {
        "text": "Tonnage",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "1.5 Ton",
          "2 Ton",
          "2.5 Ton",
          "3 Ton",
          "3.5 Ton",
          "4 Ton",
          "5 Ton"
        ],
        "default_checked": false
      },
      {
        "text": "Distribution System Configuration",
        "type": "status",
        "order_index": 6,
        "answer_choices": [
          "Central",
          "Insulated Ductwork",
          "Ductwork"
        ],
        "default_checked": true
      },
      {
        "text": "Air Conditioning: HVAC Tonnage",
        "type": "information",
        "order_index": 7,
        "comment": "The HVAC systems were being inspected by a HVAC contractor at the time of the inspection and therefore, it was not inspected by AGI."
      },
      {
        "text": "Distribution Ducting Type",
        "type": "status",
        "order_index": 7,
        "answer_choices": [
          "Insulated"
        ],
        "default_checked": true
      },
      {
        "text": "General: Energy Source",
        "type": "status",
        "order_index": 8,
        "answer_choices": [
          "Electric"
        ],
        "default_checked": true
      },
      {
        "text": "General: System Type",
        "type": "status",
        "order_index": 9,
        "answer_choices": [
          "Central Air",
          "Heat Pump",
          "Mini-Split",
          "Window Unit"
        ],
        "default_checked": true
      },
      {
        "text": "General: Cooling Limitations",
        "type": "information",
        "order_index": 14,
        "comment": "The thermostat could not be properly inspected due to the HVAC system being inoperable at the time of inspection."
      },
      {
        "text": "General: Main House Not Inspected",
        "type": "information",
        "order_index": 15,
        "comment": "The attic was mostly inaccessible. I recommend that an HVAC technician inspect the ductwork after they’re made safe to access."
      },
      {
        "text": "General: Thermostat Inspection Limitation - inoperable",
        "type": "information",
        "order_index": 16,
        "comment": "The attic had low head clearance and no rafter coverage for walking. As a result, the inspection of some of the ductwork was done from a distant, limited vantage point. Some minor defects may not have been visible"
      },
      {
        "text": "General: HVAC Inspection Limitation - Disconnected",
        "type": "information",
        "order_index": 20,
        "comment": "The hvac ducts were run in the crawlspace and the inspection of the crawlspace was limited to the exterior walls. As a result, some minor defects may not have been visible."
      },
      {
        "text": "General: HVAC Inspection Limitation - Breaker Off",
        "type": "information",
        "order_index": 21,
        "comment": "The HVAC unit was disconnected and not operable at the time of the inspection and therefore not inspected."
      },
      {
        "text": "General: HVAC Inspection Limitation - Inoperable",
        "type": "information",
        "order_index": 22,
        "comment": "The breaker for the air conditioning was off inside the electrical panel. It is unclear why the breaker was off, however the air conditioning system was not tested. I recommend consulting with the sellers to determine the reason for the breaker being off and addressing as necessary."
      },
      {
        "text": "General: HVAC Inspection Limitation - Low Temperature",
        "type": "information",
        "order_index": 23,
        "comment": "Parts of the hvac system were inoperable and therefore the hvac system could not be thoroughly inspected."
      },
      {
        "text": "General: HVAC Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 24,
        "comment": "The A/C unit was not thoroughly tested due to low outdoor temperature. I did run it long enough to ensure it came on and cooled. However, it is in your best interest to have the system thoroughly cleaned, serviced and inspected by a HVAC professional when weather permits."
      },
      {
        "text": "General: HVAC Inspection Limitation - Thermostat Inoperable",
        "type": "information",
        "order_index": 25,
        "comment": "There was no electricity during the inspection and therefore the proper operation of the HVAC could not be determined."
      },
      {
        "text": "General: HVAC Inspection Limitation - Inaccessible",
        "type": "information",
        "order_index": 26,
        "comment": "The thermostat was inoperable and, therefore, the functionality of the system could not be verified and thoroughly inspected."
      },
      {
        "text": "General: HVAC Inspection Limitation - Incomplete Install",
        "type": "information",
        "order_index": 27,
        "comment": "The HVAC equipment in the attic was inaccessible. I recommend having this equipment inspected after the equipment is made accessible."
      },
      {
        "text": "General: Inspection Limitation - Unplugged",
        "type": "information",
        "order_index": 28,
        "comment": "The HVAC wasn’t completely installed and therefore not thoroughly inspected."
      },
      {
        "text": "General: HVAC Inspection Limitation - Thermostat Missing",
        "type": "information",
        "order_index": 29,
        "comment": "The window air conditioning was unplugged, and therefore not inspected for functionality. I recommend asking the seller is why it’s unplugged."
      },
      {
        "text": "General: Inspection Limitation - Inaccessible",
        "type": "information",
        "order_index": 30,
        "comment": "The thermostats for the HVAC systems were disconnected and therefore the HVAC equipment could not be tested for proper functionality. I recommend having a full evaluation of the HVAC system once all equipment is installed."
      },
      {
        "text": "General: Inspection Limitation - Thermostat",
        "type": "information",
        "order_index": 31,
        "comment": "The HVAC ductwork was covered by the vapor barrier under the manufactures home and couldn’t be visibly inspected."
      },
      {
        "text": "Air Conditioning: Air Conditioning",
        "type": "information",
        "order_index": 33,
        "comment": "The thermostat was set to a schedule and I was not able to get it to function as intended. I recommend having the seller turn the schedule off and the HVAC system tested for functionality."
      }
    ]
  },
  {
    "name": "Furnace / Heater",
    "order_index": 11,
    "checklists": [
      {
        "text": "Manufacturer",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Amana",
          "Goodman"
        ],
        "default_checked": false
      },
      {
        "text": "General: Data Tag - Missing",
        "type": "information",
        "order_index": 1,
        "comment": "The furnace did not have a data tag visible."
      },
      {
        "text": "Furnace Operation Temperature",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Below 90 Degrees (Inadequate)",
          "90-120 Degrees (Functional)"
        ],
        "default_checked": false
      },
      {
        "text": "Location",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Attic",
          "HVAC Closet",
          "Garage",
          "Utility Room",
          "Laundry Room"
        ],
        "default_checked": false
      },
      {
        "text": "Energy Source",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Electric",
          "Natural Gas"
        ],
        "default_checked": false
      },
      {
        "text": "System Data Plate",
        "type": "status",
        "order_index": 4,
        "default_checked": false
      },
      {
        "text": "General: Heating Limitations",
        "type": "information",
        "order_index": 8,
        "comment": "The following items are not included in this inspection: humidifiers, dehumidifiers, electronic air filters, solar, coal or wood fired heat systems, thermostat or temperature control accuracy and timed functions, heating components concealed within the building structure or in inaccessible areas, underground utilities and systems, safety devices and controls (due to automatic operation). Note that the inspector does not provide estimated life expectancy, determine if heating systems are appropriately sized or perform any evaluations that require a pilot light to be lit."
      },
      {
        "text": "General: Unable to Inspect - Heating Source",
        "type": "information",
        "order_index": 9,
        "comment": "The heating source was a gas wall insert. Due to the gas and the pilot being off, the functionality of this unit could not be confirmed. I recommend asking the seller about it's functionality to ensure it is in good working order."
      },
      {
        "text": "General: Furnace Inspection Limitation - Inaccessible",
        "type": "information",
        "order_index": 10,
        "comment": "The furnace was inaccessible due to limited access and the visible inspection was done from a distant, limited vantage point. However, I was able to test its functionality."
      },
      {
        "text": "General: Heating Limitation - Thermostat",
        "type": "information",
        "order_index": 11,
        "comment": "I could not figure out how to get the thermostat to work. As a result, I was not able to check the functionality of the furnace."
      },
      {
        "text": "General: Furnace Inspection Limitation - Gas Off at the Meter",
        "type": "information",
        "order_index": 12,
        "comment": "The gas was turned off at the meter. In order to confirm proper functionality, I recommend having it cleaned, serviced, and certified by an HVAC professional after the gas is turned back on."
      },
      {
        "text": "General: Furnace Inspection Limitation - Gas Off at Furnace",
        "type": "information",
        "order_index": 13,
        "comment": "The gas valve was turned off at the furnace during the time of the inspection therefore it was not tested or thoroughly inspected."
      },
      {
        "text": "General: Furnace Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 14,
        "comment": "The furnace was installed correctly. However, due to the electricity being off, it’s functionality couldn’t be confirmed."
      },
      {
        "text": "General: Heating Inspection Limitation",
        "type": "information",
        "order_index": 15,
        "comment": "The temperature in the house was higher than the set point for the furnace would go on the thermostat. I recommend having a qualified HVAC professional do a thorough inspection when conditions are better."
      },
      {
        "text": "Forced Air Furnace: Furnace",
        "type": "information",
        "order_index": 16,
        "comment": "The heating system for the home was visually inspected and tested for functionality. Temperatures were taken at the registers to ensure that the ducts were providing sufficient heat to each room."
      }
    ]
  },
  {
    "name": "Water Heater",
    "order_index": 12,
    "checklists": [
      {
        "text": "Manufacturer",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "AO Smith",
          "Rheem",
          "Bradford White",
          "GE",
          "Whirlpool",
          "State",
          "American",
          "Rinnai",
          "Noritz",
          "Navien",
          "Bosch",
          "Takagi",
          "Unknown",
          "Other"
        ],
        "default_checked": false
      },
      {
        "text": "Data Plate",
        "type": "status",
        "order_index": 1,
        "default_checked": false
      },
      {
        "text": "Temperature Output",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Below 110 Degrees (Inadequate)",
          "111-135 Degrees (Functional)",
          "Above 135 Degrees (Safety Concern)"
        ],
        "default_checked": false
      },
      {
        "text": "Location",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Garage",
          "Basement",
          "Closet",
          "Utility Room",
          "Attic",
          "Crawl Space",
          "Exterior",
          "Laundry Room"
        ],
        "default_checked": false
      },
      {
        "text": "Power Source/Type",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Electric",
          "Natural Gas",
          "Propane"
        ],
        "default_checked": false
      },
      {
        "text": "Holding Capacity",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "50 Gallon",
          "40 Gallon",
          "30 Gallon",
          "Tankless",
          "50 Gallon x 2",
          "40 Gallon x 2"
        ],
        "default_checked": false
      },
      {
        "text": "Water Heater: Water Heater Output Temperature",
        "type": "information",
        "order_index": 5,
        "comment": "The gas was off at the water heater and therefore the functionality could not be verified."
      },
      {
        "text": "General: Inspection Limitation - Gas Off",
        "type": "information",
        "order_index": 8,
        "comment": "The pilot was off at the water heater and therefore the functionality could not be verified."
      },
      {
        "text": "General: Inspection Limitation - Pilot Off",
        "type": "information",
        "order_index": 9,
        "comment": "The water was off at the main and therefore the functionality could not be verified."
      },
      {
        "text": "General: Inspection Limitation - Water Off",
        "type": "information",
        "order_index": 10,
        "comment": "The water heater could not be tested for functionality because the electrical breaker was shut off. We do not operate breakers. We have to assume the seller has it off for a reason. I recommend asking them about its functionality."
      },
      {
        "text": "General: Inspection Limitation - Breaker Off",
        "type": "information",
        "order_index": 11,
        "comment": "The water heaters could not be thoroughly inspected because they were located in a wall cavity and access wasn’t provided by the seller. I recommend having the seller make it accessible and have a plumber determine if any repairs are needed."
      },
      {
        "text": "General: Inspection Limitation - Inside Wall Cavity",
        "type": "information",
        "order_index": 12,
        "comment": "The water heaters functionality could not be tested because it was not connected to electricity."
      },
      {
        "text": "General: Inspection Limitation - No Electrical Installed",
        "type": "information",
        "order_index": 13,
        "comment": "The cover to the water heater was secured and the water heater inaccessible for a visual inspection."
      },
      {
        "text": "General: Inspection Limitation - Cover Secured",
        "type": "information",
        "order_index": 14,
        "comment": "The water heater was inaccessible, and could only be viewed from a distance. Any defects will be listed in this section. Some defects may not have been visible."
      },
      {
        "text": "General: Inspection Limitation - Inacessible",
        "type": "information",
        "order_index": 15,
        "comment": "The functionality of the water heater could not be tested due to a being unplugged. I recommend asking the seller about its functionality to ensure that it works as intended."
      },
      {
        "text": "General: Inspection Limitation - Unplugged",
        "type": "information",
        "order_index": 16,
        "comment": "The following items are not included in this inspection: water recirculation pumps, solar water heating systems, energy saver controls or catch pan drains."
      },
      {
        "text": "Water Heater: Excluded Items",
        "type": "information",
        "order_index": 17,
        "comment": "The water heater data plate contains information such as serial number, model number, capacity and other information specific to the heater."
      }
    ]
  },
  {
    "name": "Electrical",
    "order_index": 13,
    "checklists": [
      {
        "text": "Service Panel: Main Service Panel",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Main Service Panel"
        ],
        "default_checked": false
      },
      {
        "text": "Service Panel: Type",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Circuit Breaker",
          "Fuses",
          "Combination"
        ]
      },
      {
        "text": "General: 220/240 Receptacle - Not Present",
        "type": "information",
        "order_index": 1,
        "comment": "There wasn’t a 220/240 plug installed. The connection was gas."
      },
      {
        "text": "Service Panel: Amperage",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "200 Amp",
          "150 Amp",
          "125 Amp",
          "100 Amp",
          "60 Amp",
          "Unknown"
        ],
        "default_checked": false
      },
      {
        "text": "Electric Panel: Branch Wiring & Breakers",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Panel Interior Wiring"
        ],
        "default_checked": false
      },
      {
        "text": "Service Panel: Manufacturer",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Square D",
          "General Electric",
          "Siemens",
          "Cutler-Hammer",
          "Murray",
          "ITE",
          "Challenger",
          "Federal Pacific",
          "Zinsco",
          "Pushmatic",
          "Other",
          "Unknown"
        ]
      },
      {
        "text": "Sub Panel: Location",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Garage",
          "Basement",
          "Closet",
          "Utility Room",
          "Attic",
          "Crawl Space",
          "Exterior",
          "Laundry Room",
          "Kitchen",
          "Bathroom",
          "Hallway",
          "Living Space",
          "Mechanical Room",
          "Furnace Room",
          "Under Stairs",
          "Pantry",
          "Master Bedroom",
          "Hall Closet",
          "Entry Closet",
          "Linen Closet",
          "Storage Room",
          "Carport",
          "Patio",
          "Porch",
          "Multiple Locations",
          "Office",
          "Bedroom",
          "Workshop",
          "Dining Room",
          "Family Room",
          "Left Side of House"
        ]
      },
      {
        "text": "Sub Panel: Type",
        "type": "status",
        "order_index": 6,
        "answer_choices": [
          "Circuit Breaker",
          "Fuses",
          "Combination",
          "Disconnect",
          "Transfer Switch",
          "Load Center",
          "Unknown"
        ]
      },
      {
        "text": "Service Entrance: Method",
        "type": "status",
        "order_index": 7,
        "answer_choices": [
          "Overhead",
          "Underground"
        ]
      },
      {
        "text": "Service Entrance: Material",
        "type": "status",
        "order_index": 8,
        "answer_choices": [
          "Copper",
          "Aluminum",
          "Unknown"
        ]
      },
      {
        "text": "Sub Panel: Manufacturer",
        "type": "status",
        "order_index": 9,
        "answer_choices": [
          "Square D"
        ]
      },
      {
        "text": "Branch Wiring Circuits & Breakers: Branch Wiring",
        "type": "information",
        "order_index": 10,
        "comment": "The AFC and GFCI breakers were tested for proper functionality.",
        "answer_choices": [
          "Copper",
          "Aluminum",
          "Combination"
        ]
      },
      {
        "text": "Branch Wiring Circuits & Breakers: Sheathing",
        "type": "information",
        "order_index": 11,
        "comment": "There are several critical electrical components and areas that fall outside the scope of this inspection: low-voltage systems, concealed or inaccessible wiring, generator systems, surge suppressors, lighting control systems, or the adequacy of the bonding, grounding or capacity. It is highly recommended that, if necessary, a qualified electrical specialist be consulted for a more detailed evaluation of any of the items listed above to ensure the safety and performance of the entire electrical system.",
        "answer_choices": [
          "Romex",
          "BX",
          "MC Cable",
          "Conduit"
        ]
      },
      {
        "text": "Branch Wiring Circuits & Breakers: Panel Branch Wiring",
        "type": "information",
        "order_index": 12,
        "comment": "Arc-fault circuit interrupter (AFCI) protection was installed in the main service panel, which (typically) is to protect electrical circuits and electrical equipment/appliances in bedrooms, family rooms, dining rooms and living rooms."
      },
      {
        "text": "Service Entrance: Service Entrance",
        "type": "information",
        "order_index": 24,
        "comment": "There was no electricity during the inspection and therefore the operation of the lights, switches and receptacles could not be determined."
      },
      {
        "text": "Service Entrance: Meter",
        "type": "information",
        "order_index": 25,
        "comment": "Exterior light fixtures can be on motion detectors, from dusk to dawn sensors, timers, etc. For this reason, we are not always able to confirm whether exterior lights work."
      },
      {
        "text": "Electrical Limitations",
        "type": "information",
        "order_index": 26,
        "comment": "220V/240V receptacles are not tested for voltage or polarity, as they cannot be tested with a standard receptacle tester. The tools and the knowledge for this would be provided by an electrician. Only visual deficiencies will be reported.",
        "default_checked": true
      },
      {
        "text": "General: AFCI Protection Installed",
        "type": "information",
        "order_index": 27,
        "comment": "The gas pilot to the exterior lights was turned off and could not be tested for functionality. I recommend asking the sellers for more information on their operation."
      },
      {
        "text": "General: GFCI Protection Installed",
        "type": "information",
        "order_index": 28,
        "comment": "The electrical service panel was blocked, preventing the removal of the dead front cover. Therefore the interior could not be inspected. I recommend getting access so that the interior can be inspected."
      },
      {
        "text": "General: Electrical Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 29,
        "comment": "Installed smoke and/or CO detectors are required in the home. However, these detectors are not tested as part of the home inspection. For them to be tested, a supply of smoke and/or CO would have to be administered to the sensing agent of the detector. The \"push\" test button only verifies if there is a power source going to the detector."
      },
      {
        "text": "General: Exterior Light Fixtures Disclaimer",
        "type": "information",
        "order_index": 30,
        "comment": "Switches are sometimes connected to fixtures that require specialized conditions to operate, such as darkness or movement. Sometimes they are connected to electrical receptacles (and sometimes only the top or bottom half of a receptacle). As a result, determining the actual functionality of all electrical equipment may not be possible. Any examples will be noted in this section."
      },
      {
        "text": "General: 220/240 Receptacle - Not Tested",
        "type": "information",
        "order_index": 31,
        "comment": "There is an active wasps next inside of the exterior panel therefore it was not thoroughly inspected."
      },
      {
        "text": "General: Inspection Limitation - Gas Lantern Pilot Off",
        "type": "information",
        "order_index": 32,
        "comment": "Most of the electrical light fixtures were not installed. I’m addition, a lot of breakers were turned off. This was likely a decision made by the electrician doing the work on the house. I recommend having it all thoroughly inspected once all work is complete."
      },
      {
        "text": "General: Electrical Inspection Limitation - Panel Blocked",
        "type": "information",
        "order_index": 33,
        "comment": "The dead front for the electric panel was removed when I got to it and therefore left the same way when the inspection was complete."
      },
      {
        "text": "General: Electrical Inspection Limitation - Panel Locked",
        "type": "information",
        "order_index": 34,
        "comment": "Home branch circuit wiring consists of wiring distributing electricity to devices such as switches, receptacles, and appliances. Most conductors are hidden behind floor, wall and ceiling coverings and cannot be evaluated by the inspector. The Inspector does not remove cover plates and inspection of branch wiring is limited to proper response to a representative number of switches and electrical receptacles."
      },
      {
        "text": "General: Smoke/CO Detector Information",
        "type": "information",
        "order_index": 35,
        "comment": "The electric panel was locked. I recommend having the panel thoroughly inspected once the lock is removed."
      },
      {
        "text": "General: Switches Disclaimer",
        "type": "information",
        "order_index": 36,
        "comment": "The decision was made not to remove the electric panel dead front. It was raining very hard and in my opinion removing it was a safety hazard. I recommend having an electrician inspect the panel to ensure there are no major issues."
      },
      {
        "text": "General: Electric Panel Inspection Limitation - Wasp Nest",
        "type": "information",
        "order_index": 37,
        "comment": "I wasn’t able to get the front cover off the electric panels. I recommend having it made accessible and having an electrician determine if any repairs are needed."
      },
      {
        "text": "General: Electrical Inspection Limitation - Breakers Off",
        "type": "information",
        "order_index": 38,
        "comment": "The electric panel breakers were off at the time of the inspection, and therefore not thoroughly inspected or tested for functionality."
      },
      {
        "text": "General: Electric Panel - Deadfront Off",
        "type": "information",
        "order_index": 39,
        "comment": "The AFCI/GFCI breakers in the electric panels were not tested for functionality due to the home being occupied. I highly recommend manually checking the tripping mechanism before moving in, to ensure they function as intended."
      },
      {
        "text": "General: Electrical Inspection Limitation - Branch Circuits",
        "type": "information",
        "order_index": 40,
        "comment": "The electric panel was sealed to the wall. I tried to cut it loose but could get it off. I recommend having the seller have it removed and the inside inspected. Issues behind electric panel covers can get expensive."
      },
      {
        "text": "General: Electrical Inspection Limitation - Locked",
        "type": "information",
        "order_index": 41,
        "comment": "The screw holding the cover in place was rusted and I was not able to get it off. As a result the inside of the panel could not be thoroughly inspected."
      },
      {
        "text": "General: Electrical Inspection Limitation - Unsafe to Remove Cover",
        "type": "information",
        "order_index": 42,
        "comment": "A sub panel is a smaller electrical panel that receives power from the main electrical panel and distributes electricity to specific areas or circuits within a building. Sub panels help manage electrical loads, provide additional circuit capacity, and allow for more organized electrical distribution in larger homes or buildings with complex electrical needs."
      },
      {
        "text": "General: Electrical Inspection Limitation - Unable to Remove Cover",
        "type": "information",
        "order_index": 43,
        "comment": "The sheathing around the branch wiring was melted. I recommend having a licensed electrician determine what repairs need to be made."
      },
      {
        "text": "General: Inspection Limitation - Breakers Off",
        "type": "information",
        "order_index": 44
      },
      {
        "text": "General: AFCI/GFCI Breakers - Not Tested for Functionality",
        "type": "information",
        "order_index": 45
      },
      {
        "text": "General: Electric Panel Limitation - Sealed Shut",
        "type": "information",
        "order_index": 46
      },
      {
        "text": "General: Inspection Limitation - Screw Rusted",
        "type": "information",
        "order_index": 47
      },
      {
        "text": "Branch Wiring Circuits & Breakers: Melted Sheathing",
        "type": "information",
        "order_index": 50
      }
    ]
  },
  {
    "name": "Plumbing",
    "order_index": 14,
    "checklists": [
      {
        "text": "Drain, Waste, & Vent - Material",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "PVC",
          "Cast Iron",
          "Copper",
          "Potentially Cast Iron (Due to Age)"
        ],
        "default_checked": false
      },
      {
        "text": "Jetted Tub - Operational",
        "type": "information",
        "order_index": 0,
        "default_checked": false
      },
      {
        "text": "General: Source of Water Supply",
        "type": "information",
        "order_index": 1,
        "comment": "The plumbing fixture could not be thoroughly inspected because of debris.",
        "answer_choices": [
          "Public",
          "Private Well",
          "Cistern",
          "Unknown",
          "Community Well",
          "Spring"
        ]
      },
      {
        "text": "General: Plumbing Limitations",
        "type": "information",
        "order_index": 1,
        "comment": "The main water was shut off at the time of the inspection and therefore, none of the plumbing operation or drainage could be thoroughly inspected. Only a visible inspection could be and was performed."
      },
      {
        "text": "Water Supply - Material",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Copper",
          "Plastic",
          "Potential for Galvanized ( Due to Age)"
        ],
        "default_checked": false
      },
      {
        "text": "General: Plumbing Fixture Inspection Limitation - Debris",
        "type": "information",
        "order_index": 2,
        "comment": "The jetted tub was filled and the jets were then tested for function."
      },
      {
        "text": "General: Gas Inspection Limitation - Gas Off",
        "type": "information",
        "order_index": 3,
        "comment": "The plumbing and fixture could not be tested for functionality because the water was off. We do not operate supply valves in case the seller has them off for a reason. I recommend asking them for more information."
      },
      {
        "text": "General: Jetted Tub Inspection Limitation - Access",
        "type": "information",
        "order_index": 4,
        "comment": "Most water drainage pipes were not visible due to wall, floor and ceiling coverings and therefore not visibly inspected."
      },
      {
        "text": "General: Plumbing Fixture Inspection Limitation - Water Supply Off",
        "type": "information",
        "order_index": 5,
        "comment": "The water heater was not accessible, therefore it could not be visually inspected."
      },
      {
        "text": "General: Plumbing Drainage Inspection Limitation - Inaccessible",
        "type": "information",
        "order_index": 6,
        "comment": "The tub stopper was damaged and would not seal the drain; therefore, the jets could not be inspected."
      },
      {
        "text": "Water Supply: Water Supply Material",
        "type": "information",
        "order_index": 6,
        "comment": "There are areas and components of the plumbing system that are excluded from the inspection: sewer lines and septic systems, private wells, water quality, water pressure, underground pipes, private drain fields, or fixtures not in service. If any of these require a more detailed evaluation or inspection, I recommend you have a qualified contractor inspect and verify the proper operation of excluded plumbing systems and components.",
        "answer_choices": [
          "Copper",
          "PEX",
          "CPVC",
          "Galvanized",
          "PVC",
          "Polybutylene",
          "Lead",
          "Combination"
        ]
      },
      {
        "text": "General: Water Heater Inspection Limitation - Inaccessible",
        "type": "information",
        "order_index": 7,
        "comment": "The gas was turned off at the meter. In order to determine the condition of the water heater, I recommend having it thoroughly inspected once the gas is on and the pilots lit."
      },
      {
        "text": "General: Jetted Tub Inspection Limitation - Functionality",
        "type": "information",
        "order_index": 8,
        "comment": "The water heater was installed correctly. However, it’s functionality could not be confirmed due to the electricity being off."
      },
      {
        "text": "General: Water Heater Inspection Limitation - Gas Off at the Meter",
        "type": "information",
        "order_index": 9,
        "comment": "The jetted tub was visually inspected. However, the breaker controlling the pump was switched off. We do not turn them back on, in case the seller has it off for safety reasons. I recommend asking the seller about it’s functionality."
      },
      {
        "text": "General: Water Heater Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 10,
        "comment": "Most of the plumbing under the home in the crawlspace was inaccessible and therefore not inspected."
      },
      {
        "text": "Fixtures: Jetted Tub Functionality",
        "type": "information",
        "order_index": 10,
        "comment": "Tub and sink overflows are not tested for functionality due to the very high likelihood the gaskets will leak."
      },
      {
        "text": "General: Jetted Tub Inspection Limitation - Breaker Off",
        "type": "information",
        "order_index": 11,
        "comment": "The main water supply was off at the meter and the water heaters functionality could not be confirmed."
      },
      {
        "text": "General: Plumbing Inspection Limitation - Crawlspace Inaccessible",
        "type": "information",
        "order_index": 12,
        "comment": "The water heater could not be operated because the shut-off breaker was in the off position."
      },
      {
        "text": "General: Tub/Sink Overflow Information",
        "type": "information",
        "order_index": 12,
        "comment": "The gas was off at the meter. I recommend having the seller turn on the gas and check all gas appliances prior to deadlines."
      },
      {
        "text": "General: Water Heater Inspection Limitation - Water Off",
        "type": "information",
        "order_index": 13,
        "comment": "The water heater could not be visually inspected, nor get the information from the data tag; manufacturer date, gallons, type, etc. because it was wrapped/covered."
      },
      {
        "text": "General: Water Heater Inspection Limitation - Breaker Off",
        "type": "information",
        "order_index": 14,
        "comment": "The pilot to the water heater was off and therefore the functionality could not be inspected."
      },
      {
        "text": "General: Water Heater Inspection Limitation - Wrapped/Covered",
        "type": "information",
        "order_index": 15,
        "comment": "The water supply could not be visually inspected, because it was wrapped/covered."
      },
      {
        "text": "General: Water Heater Inspection Limitation - Pilot Off",
        "type": "information",
        "order_index": 16,
        "comment": "The water heater was present, but not completely installed. I recommend having a plumber, complete the installation and inspect the water heater for any defects."
      },
      {
        "text": "General: Water Supply Inspection Limitation - Wrapped/Covered",
        "type": "information",
        "order_index": 17,
        "comment": "Not all ventilation in the attic was accessible at the time of inspection. Inspector recommends a full evaluation once all areas are made accessible."
      },
      {
        "text": "General: Water Heater Inspection Limitation – Incomplete Install",
        "type": "information",
        "order_index": 18,
        "comment": "The home's well water equipment was not thoroughly inspected or tested, as this is beyond the scope of a home inspection. In order to ensure that the well equipment is in good condition, is properly installed, and that the water quality is safe for drinking, I recommend contacting a qualified well drilling contractor to have them inspect and certify the well; as well as to perform water quality testing."
      },
      {
        "text": "General: Plumbing Ventilation - Inaccessible",
        "type": "information",
        "order_index": 19,
        "comment": "The water spigot was winterized at the time of inspection and therefore not inspection."
      },
      {
        "text": "General: Water Spigot Limitation - Winterized",
        "type": "information",
        "order_index": 20,
        "comment": "The plumbing fixture and drainage could not be inspected for functionality due to occupants belongings. I recommend checking it when they are removed."
      },
      {
        "text": "General: Inspection Limitation - Lantern Gas Supply Off",
        "type": "information",
        "order_index": 21,
        "comment": "The water supply is equipped with a water softener. This system will require maintenance, therefore I recommend acquiring the Owners Manual and familiarizing yourself with the equipment and the recommended maintenance from the manufacturer.Here is a helpful link where you can download the Owners Manual for most water softener systems!* The water softener is outside the scope of the home inspection, therefore it was not tested or inspected. The above comments are a courtesy."
      },
      {
        "text": "General: Plumbing Limitation - Occupant Belongings",
        "type": "information",
        "order_index": 22,
        "comment": "One or more water spigots were not inspected due to being connected to a landscaping timer."
      },
      {
        "text": "Water Spigot: Water Spigot Inspection Limitation - Winterized",
        "type": "information",
        "order_index": 23
      },
      {
        "text": "Water Spigot: Water Spigot Inspection Limitation - On Timer",
        "type": "information",
        "order_index": 24
      },
      {
        "text": "Vents & Flues: Ventilation Inspection Limitation - Inaccessible",
        "type": "information",
        "order_index": 25
      },
      {
        "text": "General: Well Water - Water Quality Testing",
        "type": "information",
        "order_index": 31,
        "comment": "The gas lanterns were not tested for functionality because the gas valves was off. Replacing lanterns can be expensive, and I recommend asking the seller about their functionality to ensure they work as intended."
      },
      {
        "text": "Water Supply: Water Softener",
        "type": "information",
        "order_index": 35,
        "comment": "Thermal imaging was taken at the plumbing fixtures and all exterior walls/ceilings throughout the property, in an effort to minimize the risk of missing a latent defect; leak or improper drainage."
      },
      {
        "text": "Water Supply: Well Water - Recommend Water Quality Test",
        "type": "information",
        "order_index": 36
      },
      {
        "text": "Thermal Imaging: Leak Detection / Drainage",
        "type": "information",
        "order_index": 40
      }
    ]
  },
  {
    "name": "Fireplace & Chimney",
    "order_index": 15,
    "checklists": [
      {
        "text": "Fireplace: Type",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Wood Burning",
          "Gas",
          "Electric",
          "Pellet",
          "Ethanol",
          "None"
        ]
      },
      {
        "text": "General: Taken Out of Service",
        "type": "information",
        "order_index": 2,
        "comment": "The fireplace had been sealed and no longer in operation."
      },
      {
        "text": "Fireplace System: OK",
        "type": "status",
        "order_index": 3
      },
      {
        "text": "General: Fireplace and Chimney Limitations",
        "type": "information",
        "order_index": 4,
        "comment": "If the house has a chimney with a flue and fireplace, there are important components that are inaccessible and therefore excluded from the inspection: concealed flues and components, fireplace inserts and stoves, chimney liner condition, or draft and performance. The National Fire Protection Association recommends having a Level 2 Inspection upon the sale or transfer of a property. This is a thorough inspection that includes visually inspecting the inaccessible portions of the chimney/fireplace."
      },
      {
        "text": "General: Fireplace Inspection Limitation - Gas Off",
        "type": "information",
        "order_index": 5,
        "comment": "The gas supply to the fireplace was turned off, so operation of gas fireplaces could not be verified. Recommend having gas supply turned on and operation of fireplaces confirmed."
      },
      {
        "text": "General: Gas/Wood Burning Fireplace",
        "type": "information",
        "order_index": 6,
        "comment": "Full inspection of fireplaces lies beyond the scope of the General Home Inspection. For a full inspection to more accurately determine the condition of the fireplace and to ensure that safe conditions exist, it’s recommended that you have the fireplace inspected by an inspector certified by the Chimney Safety Institute of America (CSIA). Find a CSIA-certified inspector near you at http://www.csia.org/search"
      },
      {
        "text": "General: Fireplace Limitation - Wood / Ashes",
        "type": "information",
        "order_index": 7,
        "comment": "The fireplace was filled with wood and dirty and therefore it could not be thoroughly inspected. Once it is cleaned out, ensure that there aren't any cracks or physical damage."
      },
      {
        "text": "General: Fireplace Inspection Limitation - Occupant Belongings",
        "type": "information",
        "order_index": 8,
        "comment": "Due to occupants belongings, the fire place could not be inspected. Inspector recommends fire place and flue be evaluated by a qualified chimney contractor."
      },
      {
        "text": "General: Fireplace Inspection Limitation - Pilot Off",
        "type": "information",
        "order_index": 9,
        "comment": "The functionality of the gas supply and gas logs was not inspected. The pilot was off and we do not restart them in case the seller has it off for a safety reason. I recommend asking the seller about its operation."
      },
      {
        "text": "General: Flue Inspection Limitation - Access",
        "type": "information",
        "order_index": 10,
        "comment": "The fireplace flue was inaccessible in the attic and was viewed from a limited, distant vantage point. I did not see or suspect any ongoing issues in this area. However, some minor defects may not be visible."
      },
      {
        "text": "General: Inspection Limitation - Unplugged",
        "type": "information",
        "order_index": 11,
        "comment": "The fireplace was an electric insert and was unplugged. I recommend asking the sellers about its functionality."
      },
      {
        "text": "Fireplace System: Wood Burning - Recommend Level 2 Inspection",
        "type": "information",
        "order_index": 12,
        "comment": "The inspection of the chimney is limited to a visual inspection of the accessible portions. The National Fire Protection Association recommends having a Level 2 Inspection upon the sale or transfer of a property. This is a thorough inspection that includes visually inspecting the accessible portions of the chimney/fireplace. Some of the common defects found during Level 2 Inspections are listed below: Animal nesting Creosote build-up Internal flue damage Gaps between flue liners Internal cracking (mortar or flue tiles) Damaged masonry chimney Disconnected and sometimes missing chimney components Poorly installed prefabricated chimneys (gas appliances or wood burning) and fireplaces."
      }
    ]
  },
  {
    "name": "Built-In Appliances",
    "order_index": 16,
    "checklists": [
      {
        "text": "Refrigerator: Manufacturer",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Whirlpool",
          "GE",
          "Samsung",
          "LG",
          "Frigidaire",
          "KitchenAid",
          "Maytag",
          "Bosch",
          "Unknown",
          "Other"
        ]
      },
      {
        "text": "Dishwasher: Manufacturer",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Whirlpool",
          "GE",
          "Samsung",
          "LG",
          "Frigidaire",
          "KitchenAid",
          "Maytag",
          "Bosch",
          "Other",
          "Unknown"
        ]
      },
      {
        "text": "General: Dishwasher Inspection Limitation - Unplugged",
        "type": "information",
        "order_index": 1,
        "comment": "The dishwasher was unplugged therefore it was not tested."
      },
      {
        "text": "Garbage Disposal: Manufacturer",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "InSinkErator",
          "Waste King",
          "KitchenAid",
          "Moen",
          "GE",
          "Other",
          "Unknown",
          "None"
        ]
      },
      {
        "text": "Range/Oven/Cooktop: Manufacturer",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "GE",
          "Whirlpool",
          "Samsung",
          "LG",
          "Frigidaire",
          "KitchenAid",
          "Bosch",
          "Thermador",
          "Other",
          "Unknown"
        ]
      },
      {
        "text": "Range/Oven/Cooktop: Energy Source",
        "type": "status",
        "order_index": 4,
        "answer_choices": [
          "Electric",
          "Natural Gas",
          "Propane",
          "Dual Fuel"
        ]
      },
      {
        "text": "Range Hood: Manufacturer",
        "type": "status",
        "order_index": 5,
        "answer_choices": [
          "Broan",
          "GE",
          "Whirlpool",
          "Samsung",
          "LG",
          "KitchenAid",
          "Bosch",
          "Other",
          "Unknown"
        ]
      },
      {
        "text": "Range Hood: Venting Method",
        "type": "status",
        "order_index": 6,
        "answer_choices": [
          "Vented to Exterior",
          "Vented to Attic",
          "Recirculating",
          "Unknown"
        ]
      },
      {
        "text": "Microwave w/ Exhaust: Manufacturer",
        "type": "status",
        "order_index": 7,
        "answer_choices": [
          "GE",
          "Whirlpool",
          "Samsung",
          "LG",
          "Frigidaire",
          "KitchenAid",
          "Panasonic",
          "Sharp",
          "Other",
          "Unknown"
        ]
      },
      {
        "text": "Microwave w/ Exhaust: Venting Method",
        "type": "status",
        "order_index": 8,
        "answer_choices": [
          "Exterior",
          "Attic",
          "Into Cabinet",
          "Up Against Cabinet",
          "Recirculating"
        ],
        "default_checked": false
      },
      {
        "text": "Microwave - Manufacturer",
        "type": "status",
        "order_index": 9,
        "default_checked": false
      },
      {
        "text": "Microwave - Venting Method",
        "type": "status",
        "order_index": 10,
        "answer_choices": [
          "Vented to Exterior",
          "Vented to Attic",
          "Recirculating",
          "Unknown"
        ],
        "default_checked": false
      },
      {
        "text": "Range/Oven/Cooktop: Oven Functionality",
        "type": "information",
        "order_index": 11,
        "comment": "The following items are not included in this inspection: non-permanently installed household appliances such as refrigerators, freezers, ice makers, hot water dispensers and water filters, appliance timers, clocks, self and/or continuous cleaning operations, thermostat or temperature control accuracy, and lights."
      },
      {
        "text": "Range/Oven/Cooktop: Cooktop Functionality",
        "type": "information",
        "order_index": 12,
        "comment": "When permanent or built-in appliances are installed, we do a visible inspection looking for proper installation and any physical damage and we test their functionality. If there are any limitations preventing a visual and functionality inspection, those limitations will be noted."
      },
      {
        "text": "General: Kitchen Limitations",
        "type": "information",
        "order_index": 13,
        "comment": "The home was new construction and the appliances weren’t fully installed. Therefore, they were not tested for functionality."
      },
      {
        "text": "General: Appliance Operation",
        "type": "information",
        "order_index": 14,
        "comment": "The ice maker was set to the off position and therefore its functionality could not be confirmed."
      },
      {
        "text": "General: Appliances - Not Installed",
        "type": "information",
        "order_index": 15,
        "comment": "The dishwasher was loaded with occupants belongings and sometimes home owners use it as storage. Therefore the dishwasher was visually inspected, appliance turned on and then off and not ran through a cycle. This appliance should be ran through a complete cycle to ensure proper functionality and for leaks prior to the end of your inspection period."
      },
      {
        "text": "General: Ice Maker Off",
        "type": "information",
        "order_index": 16,
        "comment": "The refrigerator was unplugged. We have to assume there's a reason for that and so we do not plug them in."
      },
      {
        "text": "General: Dishwasher Inspection Limitation - Obstructed",
        "type": "information",
        "order_index": 17,
        "comment": "The refrigerator was present and visually inspected. However, it’s functionality could not be thoroughly inspected due to the electricity being off."
      },
      {
        "text": "General: Refrigerator Inspection Limitation - Unplugged",
        "type": "information",
        "order_index": 18,
        "comment": "The dishwasher was not fully installed, therefore it was not tested or inspected."
      },
      {
        "text": "General: Refrigerator Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 19,
        "comment": "The appliances could not be tested for functionality because the electricity was off at the time of the inspection."
      },
      {
        "text": "General: Dishwasher Inspection Limitation - Not Fully Installed",
        "type": "information",
        "order_index": 20,
        "comment": "These were not tested. Honestly, they are very old, gas and the way they looked, I was scared to turn them on."
      },
      {
        "text": "General: Inspection Limitation",
        "type": "information",
        "order_index": 21,
        "comment": "There was no water supplied to the dishwasher during the inspection therefore it was not tested. Water was off at the meter."
      },
      {
        "text": "General: Did Not Inspect",
        "type": "information",
        "order_index": 22,
        "comment": "The dishwasher was not ran through a cycle because it was not fully installed. I recommend asking the seller about its functionality and if operational, have the installation completed."
      },
      {
        "text": "General: Dishwasher Inspection Limitation - No Water",
        "type": "information",
        "order_index": 23,
        "comment": "The dishwasher was properly installed. However, it’s functionality could not be confirmed due to the electricity being off."
      },
      {
        "text": "General: Appliance Inspection Limitation - Install",
        "type": "information",
        "order_index": 24,
        "comment": "There was a drainage leak at the kitchen sink. As a result, the dishwasher was not inspected for functionality. I recommend running it through a cycle, once all plumbing issues are corrected."
      },
      {
        "text": "General: Dishwasher Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 25,
        "comment": "The dishwasher was installed. However, the drain line was disconnected. I did reconnect it by hand because water was leaking out of it but there is no clamp. Once fully and properly installed, I recommend running the dishwasher through a complete cycle to ensure proper functionality and drainage."
      },
      {
        "text": "General: Dishwasher Inspection Limitation - Drainage Leak",
        "type": "information",
        "order_index": 26,
        "comment": "The gas was off at the time of the inspection and as a result, not all appliances could be tested for functionality."
      },
      {
        "text": "General: Dishwasher Inspection Limitation - Drain Disconnected",
        "type": "information",
        "order_index": 27,
        "comment": "The breaker to the range oven was off at the time of the inspection and therefore not tested. I recommend asking the seller about it's functionality."
      },
      {
        "text": "General: Appliance Inspection Limitation - Gas Off",
        "type": "information",
        "order_index": 28,
        "comment": "The range was in use by the homeowner and therefore not tested for functionality. It was working for them though."
      },
      {
        "text": "General: Range Inspection Limitation",
        "type": "information",
        "order_index": 29,
        "comment": "The range/oven was unplugged and therefore not inspected for functionality."
      },
      {
        "text": "General: Inspection Limitation - In Use",
        "type": "information",
        "order_index": 30,
        "comment": "The range oven was not fully installed and therefore not tested for functionality."
      },
      {
        "text": "General: Range/Oven - Unplugged",
        "type": "information",
        "order_index": 31
      },
      {
        "text": "General: Range - Not Fully Installed",
        "type": "information",
        "order_index": 32
      }
    ]
  },
  {
    "name": "Garage",
    "order_index": 17,
    "checklists": [
      {
        "text": "Floor: Material",
        "type": "status",
        "order_index": 0,
        "answer_choices": [
          "Concrete",
          "Epoxy",
          "Sealed"
        ]
      },
      {
        "text": "Garage Door Auto-Reverse",
        "type": "information",
        "order_index": 0,
        "comment": "Garage door pressure sensors are not tested. However, the photocells were tested to ensure proper functionality. If you wish to ensure that the garage door's automatic-reverse feature complies with the manufacturer's specifications, you should have it inspected by a qualified garage door contractor."
      },
      {
        "text": "General: Floor Inspection Limitation - Covered",
        "type": "status",
        "order_index": 1
      },
      {
        "text": "Garage Door: Material",
        "type": "status",
        "order_index": 1,
        "answer_choices": [
          "Steel",
          "Wood",
          "Aluminum",
          "Fiberglass",
          "Vinyl",
          "Combination"
        ]
      },
      {
        "text": "General: Wall Inspection Limitation - Access Obstructed",
        "type": "status",
        "order_index": 2
      },
      {
        "text": "Garage Door: Insulation",
        "type": "status",
        "order_index": 2,
        "answer_choices": [
          "Insulated",
          "Not Insulated"
        ]
      },
      {
        "text": "General: Garage Inspection Limitation - Occupant Belongings",
        "type": "information",
        "order_index": 3,
        "comment": "Not all areas of the garage were visible due to occupant belongings therefore inspector disclaims any issues that may not have been visible or accessible at the time of inspection."
      },
      {
        "text": "Garage Door: Operation",
        "type": "status",
        "order_index": 3,
        "answer_choices": [
          "Manual",
          "Automatic"
        ]
      },
      {
        "text": "General: Garage Door Inspection Limitation- Access Obstructed",
        "type": "information",
        "order_index": 4,
        "comment": "The occupant's belongings blocked access to the garage door. As a result, it was not inspected. The Inspector disclaims any responsibility for confirming its condition. Inspector recommends inspection after obstruction is removed."
      },
      {
        "text": "General: Garage Door Inspection Limitation - Unplugged",
        "type": "information",
        "order_index": 5,
        "comment": "The automatic opener was unplugged at the time of the inspection. Plugging in disconnected appliances exceeds the scope of the General Home Inspection. You should ask the seller about the operation of any unplugged openers before attempting to operate them."
      },
      {
        "text": "General: Garage Door Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 6,
        "comment": "The garage floor was mostly covered with construction material and could not be thoroughly inspected."
      },
      {
        "text": "Floor: OK",
        "type": "status",
        "order_index": 6
      },
      {
        "text": "Wall & Ceiling: OK",
        "type": "status",
        "order_index": 7
      },
      {
        "text": "General: Garage Door Inspection Limitation - Missing Opener",
        "type": "information",
        "order_index": 7,
        "comment": "The garage door was inspected visually. However, the functionality could not be confirmed due to no electricity."
      },
      {
        "text": "Garage Door: OK",
        "type": "status",
        "order_index": 8
      },
      {
        "text": "General: Manual Garage Door Inspection Limitation - Locked",
        "type": "information",
        "order_index": 8,
        "comment": "The garage door could not be tested for functionality. The wall garage door opener was not installed."
      },
      {
        "text": "General: Opener Inspection Limitation - No Electricity",
        "type": "information",
        "order_index": 9,
        "comment": "The manual garage door(s) had locks installed that required tools or a key to remove, therefore the door was not tested."
      },
      {
        "text": "Garage Door Opener and Safety: OK",
        "type": "status",
        "order_index": 9
      },
      {
        "text": "Garage Door Opener and Safety: Auto-Reverse",
        "type": "information",
        "order_index": 18,
        "comment": "The occupant's belongings blocked access to one or more areas of the walls. As a result, it/they could not be visibly inspected."
      }
    ]
  },
  {
    "name": "Resources and Disclaimers",
    "order_index": 18,
    "checklists": [
      {
        "text": "General: Final Checklist",
        "type": "information",
        "order_index": 1,
        "comment": "Our goal is to treat every home with respect and leave them in the same condition as when we arrived. The following are steps taken as part of our final checklist to ensure that everything was reset to its original position/condition.\n\n- All Interior and Exterior Lights Are Off\n- All Accessible GFCI Receptacles Were Reset\n- All Gates Were Closed on The Fence\n- Dishwasher Was Finished and Off\n- Oven/Range/Cooktops Turned Off\n- Thermostat Was Reset to Original Position\n- All Exterior Doors and Windows Are Locked",
        "default_checked": false
      },
      {
        "text": "General: Post Inspection",
        "type": "information",
        "order_index": 2,
        "comment": "The \"Final Walk-Through\" prior to closing is the time for you to go back to the property to ensure there aren’t any major changes. Conditions can change between the time of a home inspection and the time of closing. Restrictions that existed during the inspection may have been removed for the walk-through, which could expose issues that weren’t visible the day of the inspection. The following are recommendations of things you can check during your final walkthrough:\n\n1. Check the heating and cooling system. Turn the thermostat to heat mode and turn the temperature setting up. Confirm that the heating system is running and making heat. Turn the thermostat to cool mode and turn the temperature setting down. Confirm the condenser fan (outside equipment) is spinning and making cool air.\n2. Operate all appliances; oven/stove, dishwasher, microwave, etc.\n3. Run the water at all plumbing fixtures, both inside and outside, and flush toilets.\n4. Operate all exterior doors, windows and locks. Sudden change of functionality with any of these could indicate serious issues, like foundation movement.\n5. Test smoke/carbon monoxide detectors, following the manufacturer's instructions. Only their presence or absence is reported on. We always recommend you replace them, unless they are clearly only a few years old or the seller can specifically say when they were installed.\n6. Ask for all remote controls to any garage door openers, fans, gas fireplaces, etc., so that you can ensure that they work before your last opportunity to have them corrected.\n7. Inspect areas that may have been restricted or covered at the time of the inspection. There are videos in your report of any such restrictions present at the time of the inspection.\n8. Ask sellers about warranties for major building systems, security codes, smart equipment, etc.\n9. Ask seller about any warranties that may be transferable or subscriptions like pool, pest control, or security.",
        "default_checked": false
      },
      {
        "text": "General: Inspections Disclaimer",
        "type": "information",
        "order_index": 30,
        "comment": "The home inspection report (Report) was prepared by AGI: Property Inspections (AGI) for the specific purposes of assessing the general condition of the building and identifying defects that are readily apparent at the time of inspection based on the limited visual, non-invasive inspection as further described below in the Scope and Limitations & Exclusions sections. No responsibility is accepted if the Report is used for any other purpose, by any other parties, than the client in this inspection.\n\nScope\nThe Report is based on a limited visual, above-ground, non-invasive inspection of the standard systems and components of the building. AGI does not open up, uncover or dismantle any part of the building as part of the inspection or undertake any internal assessment of the building, aside from the electrical panel dead front.\n\nReport Limitations & Exclusions\nThe Report is an evaluation only and not a guarantee or warranty as to the state of the building or any product, system, or feature in the building.\n\nAGI accepts no responsibility or liability for any omission in its inspection or the Report related to defects or irregularities which are not reasonably visible at the time of the inspection or which relate to components of the building:\n\n1. which are below ground or which are concealed or closed in behind finished surfaces (such as plumbing, drainage, heating, framing, ventilation, insulation, or wiring);\n2. which required the moving of anything that impeded access or limited visibility (such as floor coverings, furniture, appliances, personal property, vehicles, vegetation, debris, or soil). AGI does not move owner/occupier items for the inspection, to which access is not readily accessible. This may also include roofs, subfloors, ceiling cavities, and high, constricted, or dangerous areas, for which dangerous, hazardous, or adverse situations are possible.\n\nIn addition, the customer understands and accepts that it's possible that AGI will not find some defects because the defect may only occur intermittently or the defect has been deliberately concealed. If you believe that any of these circumstances apply, you should immediately contact AGI to try and resolve them.\n\nAny area, system, item, or component of the building not explicitly identified in the Report as having been inspected was not included in the scope of the inspection. This consists of the condition and location of any special features or services, underground services drainage, or any systems including electrical, plumbing, gas, or heating except as otherwise may be described in the Report.\n\nDescriptions in the Report of systems or appliances relate to the existence of such systems or appliances only and not the adequacy, efficiency, or life expectancy of such systems or appliances.\n\nThe Report\nis not a structural survey, engineer's report, or weather tightness inspection; does not assess compliance with the requirements of any legislation (including any act, regulation, code, or by-law) unless otherwise stated; is not a geotechnical, site or environmental report. AGI makes no representation as to the existence or absence of any hazard (as defined in the Health and Safety in Employment Act) or any hazardous substance, natural hazard, or contaminant (as those terms are defined in the Resource Management Act) in the building or property.\n\nAGI has not undertaken any title search and assumes all improvements are within the legal boundaries of the property.\n\nNo property survey or any search of the information held by the territorial authority or any other relevant authority has been undertaken. It is recommended that the customer conducts its own Land Information Memorandum or Council property file search.\n\nUnit Title Properties\nIf the property is a Unit Title property, the inspection and Report are limited to the actual unit and any accessory unit(s) and do not extend to the remainder of the building or the common areas.\n\nAGI recommends the customer obtain a copy of the financial statements and minutes from meetings of the Body Corporate to establish the history of the inspected property under such Body Corporate.\n\nResponsibility to Third Parties\nOur responsibility in connection with this Report is limited to the client to whom the Report is addressed and to that client only. We disclaim all responsibility and will accept no liability to any other party without first obtaining the written consent of AGI and the author of the Report.\n\nAGI reserves the right to alter, amend, explain, or limit any information given to any other party.\n\nPublication\nNeither the whole nor any part of the Report (or any other report provided by AGI, whether written or verbal) may be published or included in any published document, circular, or statement whether in hard copy or electronic form or otherwise disseminated or sold without the prior written approval of AGI and the inspector.\n\nClaims & Disputes\nShould any dispute arise as a result of the inspection or the Report, it must be submitted to AGI in writing as soon as practically possible but in any case, within ten working days of discovery. The customer agrees that in the event of a dispute, the Report's contents may not be used to satisfy any terms of a sale and purchase agreement until the dispute/dispute has been resolved. In the event the customer nevertheless enters into an unconditional agreement for the purchase of the subject property or makes an existing agreement unconditional before the resolution of the dispute, the customer shall be deemed to have waived the customer's rights to continue with and/or make any future claim against AGI in relation to that matter.\n\nAny claim relating to the accuracy of the Report, in the form of errors or omissions, is limited to the failure on the part of AGI to follow the Standards of Practice promulgated by the Louisiana State Board of Home Inspectors (a copy is made available for viewing along with the Pre-Inspection Agreement).\n\nExcept in the case of an emergency, the customer further agrees not to disturb, repair, replace, or alter anything that may constitute evidence relating to the dispute or claimed discrepancy before AGI has had an opportunity to re-inspect and investigate the claim. The Client understands and agrees that any failure to notify AGI or permit AGI to re-inspect as stated above shall be deemed a waiver of the customer's rights to continue with and/or make any future claim against AGI about that matter.\n\nLimitation of Liability\nThe customer acknowledges and agrees that the director(s) and employee(s) of AGI shall not be held liable to the client.\n\nAGI shall have no liability to the client for any indirect or consequential loss suffered by the client or any other person. The client indemnifies AGI concerning any claims concerning any such loss.\n\nSubject to any legal provisions, if AGI becomes liable to the customer for any reason, for any loss, damage, harm, or injury in any way connected to the inspection and/or the Report, AGI's total liability shall be limited to a sum not exceeding the original fee of the home inspection.\n\nConsumer Guarantees Act\nNothing contained in these terms and conditions shall be deemed to exclude or restrict any rights or remedies that the client may have under the Consumer Guarantees Act 1993 or otherwise at law.\n\nPartial Invalidity\nIf any provision in these terms and conditions is illegal, invalid, or unenforceable, such provision shall be deemed to be excluded or read down to the extent necessary to make the provision legal, valid, or enforceable, and the remaining provisions of these terms and conditions shall not be affected.",
        "default_checked": false
      },
      {
        "text": "Resources and Disclaimers",
        "type": "status",
        "order_index": 31,
        "comment": "General: Final Checklist\nOur goal is to treat every home with respect and leave them in the same condition as when we arrived. The following are steps taken as part of our final checklist to ensure that everything was reset to its original position/condition.\n\n• All Interior and Exterior Lights Are Off\n\n• All Accessible GFCI Receptacles Were Reset\n\n• All Gates Were Closed on The Fence\n\n• Dishwasher Was Finished and Off\n\n• Oven/Range/Cooktops Turned Off\n\n• Thermostat Was Reset to Original Position\n\n• All Exterior Doors and Windows Are Locked\n\nGeneral: Post Inspection\nThe \"Final Walk-Through\" prior to closing is the time for you to go back to the property to ensure there aren't any major changes. Conditions can change between the time of a home inspection and the time of closing. Restrictions that existed during the inspection may have been removed for the walk-through, which could expose issues that weren't visible the day of the inspection The following are recommendations of things you can check during your final walkthrough:\n\n1. Check the heating and cooling system. Turn the thermostat to heat mode and turn the temperature setting up. Confirm that the heating system is running and making heat. Turn the thermostat to cool mode and turn the temperature setting down. Confirm the condenser fan (outside equipment) is spinning and the system is making cool air.\n\n2. Operate all appliances; oven/stove, dishwasher, microwave, etc.\n\n3. Run the water at all plumbing fixtures, both inside and outside, and flush toilets.\n\n4. Operate all exterior doors, windows and locks. Sudden change of functionality with any of these, could indicate serious issues, like foundation movement.\n\n5. Test smoke/carbon monoxide detectors, following the manufacturer's instructions. Only their presence or absence is reported on. We always recommend you replace them, unless they are clearly only a few years old or the seller can specifically say when they were installed.\n\n6. Ask for all remote controls to any garage door openers, fans, gas fireplaces, etc. so that you can ensure that they work before your last opportunity to have them correct that.\n\n7. Inspect areas that may have been restricted or covered, at the time of the inspection. There are videos in your report of any such restriction present at the time of the inspection.\n\n8. Ask sellers about warranties for major building systems, security codes, smart equipment, etc.\n\n9. Ask seller about any warranties that may be transferable or subscriptions like, pool, pest control, security.\n\nGeneral: Inspections Disclaimer\nThe home inspection report (Report) was prepared by AGI: Property Inspections (AGI) for the specific purposes of assessing the general condition of the building and identifying defects that are readily apparent at the time of inspection based on the limited visual, non-invasive inspection as further described below in the Scope and Limitations & Exclusions sections. No responsibility is accepted if the Report is used for any other purpose, by any other parties, than the client in this inspection.\n\nScope\n\nThe Report is based on a limited visual, above-ground, non-invasive inspection of the standard systems and components of the building. AGI does not open up, uncover or dismantle any part of the building as part of the inspection or undertake any internal assessment of the building, aside from the electrical panel dead front.\n\nReport Limitations & Exclusions\n\nThe Report is an evaluation only and not a guarantee or warranty as to the state of the building or any product, system, or feature in the building.\n\nAGI accepts no responsibility or liability for any omission in its inspection or the Report related to defects or irregularities which are not reasonably visible at the time of the inspection or which relate to components of the building:\n\n1. which are below ground or which are concealed or closed in behind finished surfaces (such as plumbing, drainage, heating, framing, ventilation, insulation, or wiring);\n\n2. which required the moving of anything that impeded access or limited visibility (such as floor coverings, furniture, appliances, personal property, vehicles, vegetation, debris, or soil). AGI does not move owner/occupier items for the inspection, to which access is not readily accessible. This may also include roofs, subfloors, ceiling cavities, and high, constricted, or dangerous areas, for which dangerous, hazardous, or adverse situations are possible.\n\nIn addition, the customer understands and accepts that it's possible that AGI will not find some defects because the defect may only occur intermittently or the defect has been deliberately concealed. If you believe that any of these circumstances apply, you should immediately contact AGI to try and resolve them.\n\nAny area, system, item, or component of the building not explicitly identified in the Report as having been inspected was not included in the scope of the inspection. This consists of the condition and location of any special features or services, underground services drainage, or any systems including electrical, plumbing, gas, or heating except as otherwise may be described in the Report.\n\nDescriptions in the Report of systems or appliances relate to the existence of such systems or appliances only and not the adequacy, efficiency, or life expectancy of such systems or appliances.\n\nThe Report\n\nis not a structural survey, engineer's report, or weather tightness inspection; does not assess compliance with the requirements of any legislation (including any act, regulation, code, or by-law) unless otherwise stated; is not a geotechnical, site or environmental report. AGI makes no representation as to the existence or absence of any hazard (as defined in the Health and Safety in Employment Act) or any hazardous substance, natural hazard, or contaminant (as those terms are defined in the Resource Management Act) in the building or property.\n\nAGI has not undertaken any title search and assumes all improvements are within the legal boundaries of the property.\n\nNo property survey or any search of the information held by the territorial authority or any other relevant authority has been undertaken. It is recommended that the customer conducts its own Land Information Memorandum or Council property file search.\n\nUnit Title Properties\n\nIf the property is a Unit Title property, the inspection and Report are limited to the actual unit and any accessory unit(s) and do not extend to the remainder of the building or the common areas.\n\nAGI recommends the customer obtain a copy of the financial statements and minutes from meetings of the Body Corporate to establish the history of the inspected property under such Body Corporate.\n\nResponsibility to Third Parties\n\nOur responsibility in connection with this Report is limited to the client to whom the Report is addressed and to that client only. We disclaim all responsibility and will accept no liability to any other party without first obtaining the written consent of AGI and the author of the Report.\n\nAGI reserves the right to alter, amend, explain, or limit any information given to any other party.\n\nPublication\n\nNeither the whole nor any part of the Report (or any other report provided by AGI, whether written or verbal) may be published or included in any published document, circular, or statement whether in hard copy or electronic form or otherwise disseminated or sold without the prior written approval of AGI and the inspector.\n\nClaims & Disputes\n\nShould any dispute arise as a result of the inspection or the Report, it must be submitted to AGI in writing as soon as practically possible but in any case, within ten working days of discovery. The customer agrees that in the event of a dispute, the Report's contents may not be used to satisfy any terms of a sale and purchase agreement until the disagreement/dispute has been resolved. In the event the customer nevertheless enters into an unconditional agreement for the purchase of the subject property or makes an existing agreement unconditional before the resolution of the dispute, the customer shall be deemed to have waived the customer's rights to continue with and/or make any future claim against AGI in relation to that matter.\n\nAny claim relating to the accuracy of the Report, in the form of errors or omissions, is limited to the failure on the part of AGI to follow the Standards of Practice promulgated by the Louisiana State Board of Home Inspectors (a copy is made available for viewing along with the Pre-Inspection Agreement).\n\nExcept in the case of an emergency, the customer further agrees not to disturb, repair, replace, or alter anything that may constitute evidence relating to the dispute or claimed discrepancy before AGI has had an opportunity to re-inspect and investigate the claim. The Client understands and agrees that any failure to notify AGI or permit AGI to re-inspect as stated above shall be deemed a waiver of the customer's rights to continue with and/or make any future claim against AGI about that matter.\n\nLimitation of Liability\n\nThe customer acknowledges and agrees that the director(s) and employee(s) of AGI shall not be held liable to the client.\n\nAGI shall have no liability to the client for any indirect or consequential loss suffered by the client or any other person. The client indemnifies AGI concerning any claims concerning any such loss.\n\nSubject to any statutory provisions, if AGI becomes liable to the customer for any reason, for any loss, damage, harm, or injury in any way connected to the inspection and/or the Report, AGI's total liability shall be limited to a sum not exceeding the original fee of the home inspection.\n\nConsumer Guarantees Act\n\nNothing contained in these terms and conditions shall be deemed to exclude or restrict any rights or remedies that the client may have under the Consumer Guarantees Act 1993 or otherwise at law.\n\nPartial Invalidity\n\nIf any provision in these terms and conditions is illegal, invalid, or unenforceable, such provision shall be deemed to be excluded or read down to the extent necessary to make the provision legal, valid, or enforceable, and the remaining provisions of these terms and conditions shall not be affected.",
        "default_checked": false
      }
    ]
  }
];
