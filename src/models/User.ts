import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  mobileNumber?: string;
  profileImageUrl?: string;
  signatureImageUrl?: string;
  credentials?: string;
  homeAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  milesWantsToTravel?: string;
  description?: string;
  notes?: string;
  password: string;
  smsOptIn: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  role: 'inspector' | 'staff';
  company?: mongoose.Types.ObjectId;
  numberOfInspectors?: number;
  yearsOfExperience?: number;
  howDidYouHearAboutUs?: string;
  agreedToTerms: boolean;
  lastActiveAt?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  rememberMeToken?: string;
  rememberMeExpires?: Date;
  createdBy?: mongoose.Types.ObjectId;
  
  // Inspector permissions
  can_schedule_self?: boolean;
  can_schedule?: boolean;
  can_publish?: boolean;
  can_add_to_template?: boolean;
  can_edit_template?: boolean;
  can_manage_contacts?: boolean;
  can_access_conversations?: boolean;
  can_access_financial_data?: boolean;
  is_company_admin?: boolean;
  
  // Staff permissions
  can_edit_inspections?: boolean;
  can_delete_inspections?: boolean;
  
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    profileImageUrl: {
      type: String,
      trim: true,
    },
    signatureImageUrl: {
      type: String,
      trim: true,
    },
    credentials: {
      type: String,
      trim: true,
    },
    homeAddress: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    milesWantsToTravel: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    smsOptIn: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Index for quick lookups
    },
    role: {
      type: String,
      enum: ['inspector', 'staff'],
      default: 'inspector',
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Inspector permissions
    can_schedule_self: {
      type: Boolean,
      default: false,
    },
    can_schedule: {
      type: Boolean,
      default: false,
    },
    can_publish: {
      type: Boolean,
      default: false,
    },
    can_add_to_template: {
      type: Boolean,
      default: false,
    },
    can_edit_template: {
      type: Boolean,
      default: false,
    },
    can_manage_contacts: {
      type: Boolean,
      default: false,
    },
    can_access_conversations: {
      type: Boolean,
      default: false,
    },
    can_access_financial_data: {
      type: Boolean,
      default: false,
    },
    is_company_admin: {
      type: Boolean,
      default: false,
    },
    // Staff permissions
    can_edit_inspections: {
      type: Boolean,
      default: false,
    },
    can_delete_inspections: {
      type: Boolean,
      default: false,
    },
    numberOfInspectors: {
      type: Number,
      min: [1, 'Number of inspectors must be at least 1'],
    },
    yearsOfExperience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative'],
    },
    howDidYouHearAboutUs: {
      type: String,
      trim: true,
    },
    agreedToTerms: {
      type: Boolean,
      required: [true, 'You must agree to the terms and conditions'],
      default: false,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    rememberMeToken: {
      type: String,
      select: false,
    },
    rememberMeExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// Indexes are already defined in schema fields with index: true
// No need for additional index definitions here

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;

