export const SECTIONS = [
  'AC / Cooling',
  'Built-In Appliances',
  'Electrical',
  'Exterior',
  'Fireplace / Chimney',
  'Foundation & Structure',
  'Furnace / Heater',
  'Grounds',
  'Insulation & Ventilation',
  'Interior',
  'Plumbing',
  'Roof',
  'Swimming Pool & Spa',
  'Verified Functionality'
];

export const SUBSECTIONS: { [key: string]: string[] } = {
  'Grounds': ['Vegetation, Grading, & Drainage', 'Sidewalks, Porches, Driveways'],
  'Foundation & Structure': ['Foundation', 'Crawlspace', 'Floor Structure', 'Wall Structure', 'Ceiling Structure'],
  'Roof': ['Coverings', 'Flashing & Seals', 'Roof Penetrations', 'Roof Structure & Attic', 'Gutters'],
  'Exterior': ['Exterior Doors', 'Exterior Windows', 'Siding, Flashing, & Trim', 'Brick/Stone Veneer', 'Vinyl Siding', 'Soffit & Fascia', 'Wall Penetrations', 'Doorbell', 'Exterior Support Columns', 'Steps, Stairways, & Railings'],
  'Fireplace / Chimney': ['Fireplace', 'Chimney', 'Flue'],
  'Interior': ['Doors', 'Windows', 'Floors', 'Walls', 'Ceilings', 'Countertops & Cabinets', 'Trim', 'Steps, Staircase, & Railings'],
  'Insulation & Ventilation': ['Attic Access', 'Insulation', 'Vapor Barrier', 'Ventilation & Exhaust'],
  'AC / Cooling': ['Air Conditioning', 'Thermostats', 'Distribution System'],
  'Furnace / Heater': ['Forced Air Furnace'],
  'Electrical': ['Sub Panel', 'Service Panel', 'Branch Wiring & Breakers', 'Exterior Lighting', 'Fixtures, Fans, Switches, & Receptacles', 'GFCI & AFCI', '240 Volt Receptacle', 'Smoke / Carbon Monoxide Alarms', 'Service Entrance'],
  'Plumbing': ['Water Heater', 'Drain, Waste, & Vents', 'Water Supply', 'Water Spigot', 'Gas Supply', 'Vents & Flues', 'Fixtures,Sinks, Tubs, & Toilets'],
  'Built-In Appliances': ['Refrigerator', 'Dishwasher', 'Garbage Disposal', 'Microwave', 'Range Hood', 'Range, Oven & Cooktop'],
  'Swimming Pool & Spa': ['Equipment', 'Electrical', 'Safety Devices', 'Coping & Decking', 'Vessel Surface', 'Drains', 'Control Valves', 'Filter', 'Pool Plumbing', 'Pumps', 'Spa Controls & Equipment', 'Heating', 'Diving Board & Slide'],
  'Verified Functionality': ['AC Temperature Differential', 'Furnace Output Temperature', 'Oven Operation Temperature', 'Water Heater Output Temperature']
};

export const LOCATIONS = [
  'Front of House',
  'Back of House',
  'Left Side of House',
  'Right Side of House',
  'Garage',
  'Attic',
  'Basement',
  'Kitchen',
  'Living Room',
  'Master Bedroom',
  'Bathroom',
  'Exterior',
  'Roof',
  'Driveway',
  'Yard'
];
