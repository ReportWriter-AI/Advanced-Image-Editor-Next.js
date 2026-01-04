import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '../../../../../lib/db';
import User from '../../../../../src/models/User';
import Company from '../../../../../src/models/Company';
import ReusableDropdown from '../../../../../src/models/ReusableDropdown';
import { sendVerificationEmail } from '../../../../../lib/email';
import { ensureDefaultModifiersForCompany } from '../../../../../lib/modifier-service';
import { SERVICE_CATEGORIES } from '../../../../../constants/serviceCategories';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      password, 
      smsOptIn,
      numberOfInspectors,
      yearsOfExperience,
      howDidYouHearAboutUs,
      agreedToTerms
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Please provide all required fields' },
        { status: 400 }
      );
    }

    // Default company name
    const companyName = 'My Inspection Company';

    // Validate terms agreement
    if (!agreedToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the privacy policy and terms and conditions' },
        { status: 400 }
      );
    }

    // Validate numberOfInspectors if provided
    if (numberOfInspectors !== undefined && numberOfInspectors !== null) {
      if (numberOfInspectors < 1) {
        return NextResponse.json(
          { error: 'Number of inspectors must be at least 1' },
          { status: 400 }
        );
      }
    }

    // Validate yearsOfExperience if provided
    if (yearsOfExperience !== undefined && yearsOfExperience !== null) {
      if (yearsOfExperience < 0) {
        return NextResponse.json(
          { error: 'Years of experience cannot be negative' },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Step 1: Create the company
    const company = await Company.create({
      name: companyName,
      plan: 'free', // Default plan
    });

    // Step 2: Create the user with company reference
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phoneNumber: phoneNumber || undefined,
      password,
      smsOptIn: smsOptIn || false,
      isEmailVerified: false,
      numberOfInspectors: numberOfInspectors || undefined,
      yearsOfExperience: yearsOfExperience || undefined,
      howDidYouHearAboutUs: howDidYouHearAboutUs || undefined,
      agreedToTerms,
      emailVerificationToken,
      emailVerificationExpires,
      role: 'inspector', // Default role is inspector
      company: company._id,
      // Give new users full inspector permissions
      can_schedule_self: true,
      can_schedule: true,
      can_publish: true,
      can_add_to_template: true,
      can_edit_template: true,
      can_manage_contacts: true,
      can_access_conversations: true,
      can_access_financial_data: true,
      is_company_admin: true,
    });

    // Step 3: Track the company creator
    await Company.findByIdAndUpdate(company._id, {
      createdBy: user._id,
    });

    //@ts-ignore
    await ensureDefaultModifiersForCompany(company._id, user._id);

    // Step 4: Create default reusable dropdowns
    // Default location values (comma-separated)
    const defaultLocation = 'Addition, All Locations, Apartment, Attic, Back Porch, Back Room, Balcony, Bedroom 1, Bedroom 2, Bedroom 3, Bedroom 4, Bedroom 5, Both Locations, Breakfast, Carport, Carport Entry, Closet, Crawlspace, Dining, Downstairs, Downstairs Bathroom, Downstairs Bathroom Closet, Downstairs Hallway, Downstairs Hall Closet, Driveway, Entry, Family Room, Front Entry, Front of House, Front Porch, Front Room, Garage, Garage Entry, Garage Storage Closet, Guest Bathroom, Guest Bedroom, Guest Bedroom Closet, Half Bathroom, Hallway, Heater Operation Temp, HVAC Closet, Keeping Room, Kitchen, Kitchen Pantry, Left Side of House, Left Wall, Living Room, Living Room Closet, Laundry Room, Laundry Room Closet, Master Bathroom, Master Bedroom, Master Closet, Most Locations, Multiple Locations, Office, Office Closet, Outdoor Storage, Patio, Rear Entry, Rear of House, Rear Wall, Right Side of House, Right Wall, Shop, Side Entry, Staircase, Sun Room, Top of Stairs, Upstairs Bathroom, Upstairs Bedroom 1, Upstairs Bedroom 1 Closet, Upstairs Bedroom 2, Upstairs Bedroom 2 Closet, Upstairs Bedroom 3, Upstairs Bedroom 3 Closet, Upstairs Bedroom 4, Upstairs Bedroom 4 Closet, Upstairs Hallway, Upstairs Laundry Room, Utility Room, Water Heater Closet, Water Heater Output Temp';
    
    // Default section values (comma-separated)
    const defaultSection = 'AC / Cooling, Built-In Appliances, Electrical, Exterior, Fireplace / Chimney, Foundation & Structure, Furnace / Heater, Grounds, Insulation & Ventilation, Interior, Plumbing, Roof, Swimming Pool & Spa, Verified Functionality';
    
    // Default subsection values (JSON object)
    const defaultSubsection = {
      'Grounds': [
        'Vegetation, Grading, & Drainage',
        'Sidewalks, Porches, Driveways'
      ],
      'Foundation & Structure': [
        'Foundation',
        'Crawlspace',
        'Floor Structure',
        'Wall Structure',
        'Ceiling Structure'
      ],
      'Roof': [
        'Coverings',
        'Flashing & Seals',
        'Roof Penetrations',
        'Roof Structure & Attic',
        'Gutters'
      ],
      'Exterior': [
        'Exterior Doors',
        'Exterior Windows',
        'Siding, Flashing, & Trim',
        'Brick/Stone Veneer',
        'Vinyl Siding',
        'Soffit & Fascia',
        'Wall Penetrations',
        'Doorbell',
        'Exterior Support Columns',
        'Steps, Stairways, & Railings'
      ],
      'Fireplace / Chimney': [
        'Fireplace',
        'Chimney',
        'Flue'
      ],
      'Interior': [
        'Doors',
        'Windows',
        'Floors',
        'Walls',
        'Ceilings',
        'Countertops & Cabinets',
        'Trim',
        'Steps, Staircase, & Railings'
      ],
      'Insulation & Ventilation': [
        'Attic Access',
        'Insulation',
        'Vapor Barrier',
        'Ventilation & Exhaust'
      ],
      'AC / Cooling': [
        'Air Conditioning',
        'Thermostats',
        'Distribution System'
      ],
      'Furnace / Heater': [
        'Forced Air Furnace'
      ],
      'Electrical': [
        'Sub Panel',
        'Service Panel',
        'Branch Wiring & Breakers',
        'Exterior Lighting',
        'Fixtures, Fans, Switches, & Receptacles',
        'GFCI & AFCI',
        '240 Volt Receptacle',
        'Smoke / Carbon Monoxide Alarms',
        'Service Entrance'
      ],
      'Plumbing': [
        'Water Heater',
        'Drain, Waste, & Vents',
        'Water Supply',
        'Water Spigot',
        'Gas Supply',
        'Vents & Flues',
        'Fixtures,Sinks, Tubs, & Toilets'
      ],
      'Built-In Appliances': [
        'Refrigerator',
        'Dishwasher',
        'Garbage Disposal',
        'Microwave',
        'Range Hood',
        'Range, Oven & Cooktop'
      ],
      'Swimming Pool & Spa': [
        'Equipment',
        'Electrical',
        'Safety Devices',
        'Coping & Decking',
        'Vessel Surface',
        'Drains',
        'Control Valves',
        'Filter',
        'Pool Plumbing',
        'Pumps',
        'Spa Controls & Equipment',
        'Heating',
        'Diving Board & Slide'
      ],
      'Verified Functionality': [
        'AC Temperature Differential',
        'Furnace Output Temperature',
        'Oven Operation Temperature',
        'Water Heater Output Temperature'
      ]
    };

    await ReusableDropdown.create({
      company: company._id,
      createdBy: user._id,
      foundation: 'Crawlspace, Slab, Grade',
      role: 'Buyer, Seller, Attorney',
      referralSources: 'Real Estate Agent, Previous Client, Friend/Family Member, Lender, Google Search, Social Media, Our Website, Google Ad',
      location: defaultLocation,
      section: defaultSection,
      subsection: defaultSubsection,
      serviceCategory: SERVICE_CATEGORIES.join(", "),
    });

    // Send verification email
    await sendVerificationEmail(email, emailVerificationToken);

    return NextResponse.json(
      {
        message: 'Account created successfully! Please check your email to verify your account.',
        userId: user._id,
        companyId: company._id,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

