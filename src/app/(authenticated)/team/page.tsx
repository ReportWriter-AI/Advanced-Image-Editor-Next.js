"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Phone, 
  User as UserIcon,
  Shield,
  Edit,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Check,
  Info
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Permission configuration for inspectors
const inspectorPermissions = [
  { key: 'can_schedule_self', label: 'Can schedule new inspections for themself?', shortLabel: 'Self-Schedule', tooltip: 'Can this inspector schedule new inspections for themself? Self-Schedulers won\'t see all inspectors in the dashboard and can create new inspections only for themselves', color: 'blue' },
  { key: 'can_schedule', label: 'Can schedule new inspections for the team?', shortLabel: 'Team Schedule', tooltip: 'Can this inspector schedule new inspections for the whole team? Schedulers will see all inspectors in the dashboard and can create new inspections for everyone.', color: 'green' },
  { key: 'can_publish', label: 'Can publish reports?', shortLabel: 'Publish', tooltip: 'Can this inspector directly publish reports? If not, they will be queued for approval/final publishing by a company admin.', color: 'purple' },
  { key: 'can_add_to_template', label: 'Can add new comments to template?', shortLabel: 'Add to Template', tooltip: 'Can this inspector add new comments to the template? If not, they will only be able to add one-off items to a particular report.', color: 'indigo' },
  { key: 'can_edit_template', label: 'Can edit templates?', shortLabel: 'Edit Templates', tooltip: 'Can this inspector edit templates via the template editor?', color: 'orange' },
  { key: 'can_manage_contacts', label: 'Can manage contacts?', shortLabel: 'Contacts', tooltip: 'Can this person manage contacts?', color: 'teal' },
  { key: 'can_access_conversations', label: 'Can access conversations?', shortLabel: 'Conversations', tooltip: 'Can this person access conversations?', color: 'cyan' },
  { key: 'can_access_financial_data', label: 'Can access financial data?', shortLabel: 'Financial', tooltip: 'Can this person access financial data? (metrics, data exports, payments, payroll, pay splits, etc.)', color: 'yellow' },
  { key: 'is_company_admin', label: 'Full company admin?', shortLabel: 'Admin', tooltip: 'Company admins have full privileges to publish reports, add/remove team members, view metrics, modify email templates, and modify subscriptions. Otherwise, inspectors see a limited interface dealing only with their inspections and schedule.', color: 'red' },
];

// Permission configuration for staff
const staffPermissions = [
  { key: 'can_schedule', label: 'Can schedule new inspections?', shortLabel: 'Schedule', tooltip: 'Can this staff member schedule new inspections?', color: 'green' },
  { key: 'can_edit_inspections', label: 'Can edit/update inspections?', shortLabel: 'Edit Inspections', tooltip: 'Can this staff member edit/update inspections and inspection reports? Otherwise inspections are read-only.', color: 'blue' },
  { key: 'can_delete_inspections', label: 'Can delete inspections?', shortLabel: 'Delete Inspections', tooltip: 'Can this staff member delete inspections and inspection reports?', color: 'red' },
  { key: 'can_publish', label: 'Can publish reports?', shortLabel: 'Publish', tooltip: 'Can this staff member directly publish reports? If not, they will be queued for approval/final publishing by a company admin.', color: 'purple' },
  { key: 'can_add_to_template', label: 'Can add new comments to template?', shortLabel: 'Add to Template', tooltip: 'Can this staff member add new comments to the template?', color: 'indigo' },
  { key: 'can_edit_template', label: 'Can edit templates?', shortLabel: 'Edit Templates', tooltip: 'Can this staff member edit templates via the template editor?', color: 'orange' },
  { key: 'can_manage_contacts', label: 'Can manage contacts?', shortLabel: 'Contacts', tooltip: 'Can this person manage contacts?', color: 'teal' },
  { key: 'can_access_conversations', label: 'Can access conversations?', shortLabel: 'Conversations', tooltip: 'Can this person access conversations?', color: 'cyan' },
  { key: 'can_access_financial_data', label: 'Can access financial data?', shortLabel: 'Financial', tooltip: 'Can this person access financial data? (metrics, data exports, payments, payroll, pay splits, etc.)', color: 'yellow' },
  { key: 'is_company_admin', label: 'Full company admin?', shortLabel: 'Admin', tooltip: 'Company admins have full privileges to publish reports, add/remove team members, view metrics, modify email templates, and modify subscriptions. Otherwise, staff members see a limited interface dealing only with their inspections and schedule.', color: 'red' },
];

const teamMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  password: z.string().optional(),
  sendConfirmation: z.boolean(),
  profileImageUrl: z.string().optional(),
  signatureImageUrl: z.string().optional(),
  credentials: z.string().optional(),
  homeAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  milesWantsToTravel: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // If sendConfirmation is false, password is required
  if (!data.sendConfirmation && !data.password) {
    return false;
  }
  return true;
}, {
  message: 'Password is required when not sending confirmation',
  path: ['password'],
});

const editTeamMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  profileImageUrl: z.string().optional(),
  signatureImageUrl: z.string().optional(),
  credentials: z.string().optional(),
  homeAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  milesWantsToTravel: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type TeamMemberFormData = z.infer<typeof teamMemberSchema>;
type EditTeamMemberFormData = z.infer<typeof editTeamMemberSchema>;

interface TeamMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  mobileNumber?: string;
  role: 'inspector' | 'staff';
  can_schedule_self?: boolean;
  can_schedule?: boolean;
  can_publish?: boolean;
  can_add_to_template?: boolean;
  can_edit_template?: boolean;
  can_manage_contacts?: boolean;
  can_access_conversations?: boolean;
  can_access_financial_data?: boolean;
  is_company_admin?: boolean;
  can_edit_inspections?: boolean;
  can_delete_inspections?: boolean;
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
}

export default function TeamPage() {
  const { user } = useAuth();
  const [inspectors, setInspectors] = useState<TeamMember[]>([]);
  const [staff, setStaff] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [addType, setAddType] = useState<'inspector' | 'staff'>('inspector');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [companyCreatorId, setCompanyCreatorId] = useState<string | null>(null);

  const addForm = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      mobileNumber: '',
      password: '',
      sendConfirmation: true,
      profileImageUrl: '',
      signatureImageUrl: '',
      credentials: '',
      homeAddress: '',
      city: '',
      state: '',
      zipCode: '',
      milesWantsToTravel: '',
      description: '',
      notes: '',
    },
  });

  const editForm = useForm<EditTeamMemberFormData>({
    resolver: zodResolver(editTeamMemberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      mobileNumber: '',
      profileImageUrl: '',
      signatureImageUrl: '',
      credentials: '',
      homeAddress: '',
      city: '',
      state: '',
      zipCode: '',
      milesWantsToTravel: '',
      description: '',
      notes: '',
    },
  });

  // Initialize permissions with all checked
  useEffect(() => {
    const defaultPermissions: Record<string, boolean> = {};
    const permList = addType === 'inspector' ? inspectorPermissions : staffPermissions;
    permList.forEach(perm => {
      defaultPermissions[perm.key] = true;
    });
    setPermissions(defaultPermissions);
  }, [addType]);

  // Fetch team members
  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/team', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }

      const data = await response.json();
      setInspectors(data.inspectors || []);
      setStaff(data.staff || []);
      setCompanyCreatorId(data.companyCreatorId || null);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeamMember = async (data: any) => {
    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch('/api/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          role: addType,
          ...permissions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add team member');
      }

      setMessage({ type: 'success', text: result.message });
      addForm.reset();
      setShowAddModal(false);
      fetchTeamMembers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTeamMember = async (data: any) => {
    if (!editingMember) return;

    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch(`/api/team/${editingMember._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ...permissions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update team member');
      }

      setMessage({ type: 'success', text: result.message });
      editForm.reset();
      setShowEditModal(false);
      setEditingMember(null);
      fetchTeamMembers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (member: TeamMember) => {
    setMemberToDelete(member);
    setShowDeleteDialog(true);
  };

  const handleDeleteTeamMember = async () => {
    if (!memberToDelete) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/team/${memberToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete team member');
      }

      setMessage({ type: 'success', text: result.message });
      setShowDeleteDialog(false);
      setMemberToDelete(null);
      fetchTeamMembers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    editForm.reset({
      firstName: member.firstName,
      lastName: member.lastName,
      phoneNumber: member.phoneNumber || '',
      mobileNumber: member.mobileNumber || '',
      profileImageUrl: member.profileImageUrl || '',
      signatureImageUrl: member.signatureImageUrl || '',
      credentials: member.credentials || '',
      homeAddress: member.homeAddress || '',
      city: member.city || '',
      state: member.state || '',
      zipCode: member.zipCode || '',
      milesWantsToTravel: member.milesWantsToTravel || '',
      description: member.description || '',
      notes: member.notes || '',
    });

    // Set permissions from member
    const memberPermissions: Record<string, boolean> = {};
    const permList = member.role === 'inspector' ? inspectorPermissions : staffPermissions;
    permList.forEach(perm => {
      memberPermissions[perm.key] = (member as any)[perm.key] || false;
    });
    setPermissions(memberPermissions);
    setShowEditModal(true);
  };

  const getColorClasses = (color: string, enabled: boolean) => {
    if (!enabled) return 'bg-gray-100 text-gray-500 border-gray-200';
    
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      teal: 'bg-teal-100 text-teal-700 border-teal-200',
      cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      red: 'bg-red-100 text-red-700 border-red-200',
    };
    
    return colorMap[color] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const renderPermissionsList = (member: TeamMember) => {
    const permList = member.role === 'inspector' ? inspectorPermissions : staffPermissions;
    
    return (
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {permList.map(perm => {
            const hasPermission = (member as any)[perm.key];
            if (!hasPermission) return null; // Only show enabled permissions
            
            return (
              <div 
                key={perm.key} 
                className={`group relative inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border ${getColorClasses(perm.color, hasPermission)}`}
              >
                <span>{perm.shortLabel}</span>
                <div className="relative inline-flex">
                  <Info className="w-3 h-3 cursor-help" />
                  <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 shadow-lg">
                    <div className="font-semibold mb-1">{perm.label}</div>
                    <div className="text-gray-300">{perm.tooltip}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTeamMember = (member: TeamMember) => {
    const isCurrentUser = user?.id === member._id;
    const isCompanyCreator = companyCreatorId === member._id;
    
    return (
      <Card key={member._id} className="mb-3">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-12 h-12 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                {member.profileImageUrl ? (
                  <img
                    src={member.profileImageUrl}
                    alt={`${member.firstName} ${member.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-base">
                    {member.firstName[0]}
                    {member.lastName[0]}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {member.firstName} {member.lastName}
                  {member.is_company_admin && (
                    <span title="Company Admin" className="inline-block ml-2">
                      <Shield className="inline-block w-4 h-4 text-blue-600" />
                    </span>
                  )}
                  {isCompanyCreator && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Company Owner</span>
                  )}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">You</span>
                  )}
                </h3>
                <div className="text-sm text-muted-foreground space-y-1 mt-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {member.email}
                  </div>
                  {member.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {member.phoneNumber}
                    </div>
                  )}
                </div>
                {renderPermissionsList(member)}
              </div>
            </div>
            <div className="flex gap-2 sm:ml-4 sm:self-start">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditModal(member)}
                title="Edit team member"
              >
                <Edit className="w-4 h-4 text-blue-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openDeleteDialog(member)}
                disabled={isCurrentUser || isCompanyCreator}
                title={
                  isCurrentUser
                    ? "You cannot delete your own account"
                    : isCompanyCreator
                      ? "You cannot delete the company owner"
                      : "Delete team member"
                }
              >
                <Trash2 className={`w-4 h-4 ${(isCurrentUser || isCompanyCreator) ? 'text-gray-400' : 'text-red-600'}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Team Management</h1>
        <p className="text-muted-foreground">Manage your inspectors and staff members</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border mb-6 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{message.text}</p>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-5 w-5"
            onClick={() => setMessage(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Inspectors Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Inspectors
          </h2>
          <Button
            onClick={() => {
              setAddType('inspector');
              setShowAddModal(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add New Inspector
          </Button>
        </div>

        {loading && inspectors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : inspectors.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No inspectors found. Add your first inspector to get started.
            </CardContent>
          </Card>
        ) : (
          <div>
            {inspectors.map(renderTeamMember)}
          </div>
        )}
      </div>

      {/* Staff Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <UserIcon className="w-6 h-6" />
            Support Staff
          </h2>
          <Button
            onClick={() => {
              setAddType('staff');
              setShowAddModal(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add New Staff
          </Button>
        </div>

        {loading && staff.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : staff.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No staff members found. Add your first staff member to get started.
            </CardContent>
          </Card>
        ) : (
          <div>
            {staff.map(renderTeamMember)}
          </div>
        )}
      </div>

      {/* Add Team Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-2xl w-full my-8 shadow-2xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Add New {addType === 'inspector' ? 'Inspector' : 'Staff Member'}
              </CardTitle>
              <CardDescription>
                Fill in the details below to add a new team member
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto">
              <form onSubmit={addForm.handleSubmit(handleAddTeamMember)} className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <ImageUpload
                      label="Profile Photo"
                      description="Used on team lists and assignments"
                      value={addForm.watch('profileImageUrl') || ''}
                      onChange={(url) => addForm.setValue('profileImageUrl', url ?? '')}
                    />
                  </div>
                  {addType === 'inspector' && (
                    <div className="space-y-2">
                      <ImageUpload
                        label="Signature"
                        description="Inspector signature image"
                        value={addForm.watch('signatureImageUrl') || ''}
                        onChange={(url) => addForm.setValue('signatureImageUrl', url ?? '')}
                      />
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        {...addForm.register('firstName')}
                        placeholder="John"
                      />
                      {addForm.formState.errors.firstName && (
                        <p className="text-sm text-red-600">{addForm.formState.errors.firstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        {...addForm.register('lastName')}
                        placeholder="Doe"
                      />
                      {addForm.formState.errors.lastName && (
                        <p className="text-sm text-red-600">{addForm.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      {...addForm.register('email')}
                      placeholder="john@example.com"
                      className="pl-10"
                    />
                  </div>
                  {addForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{addForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      {...addForm.register('phoneNumber')}
                      placeholder="+1 (555) 000-0000"
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Inspector-only fields */}
                {addType === 'inspector' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="mobileNumber">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="mobileNumber"
                          type="tel"
                          {...addForm.register('mobileNumber')}
                          placeholder="+1 (555) 000-0000"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credentials">Credentials</Label>
                      <Input
                        id="credentials"
                        {...addForm.register('credentials')}
                        placeholder="e.g., Licensed Inspector, Certified Professional"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="homeAddress">Home Address</Label>
                      <Input
                        id="homeAddress"
                        {...addForm.register('homeAddress')}
                        placeholder="Street address"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          {...addForm.register('city')}
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          {...addForm.register('state')}
                          placeholder="State"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zipCode">Zip Code</Label>
                      <Input
                        id="zipCode"
                        {...addForm.register('zipCode')}
                        placeholder="Zip code"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="milesWantsToTravel">Miles Willing to Travel</Label>
                      <Input
                        id="milesWantsToTravel"
                        {...addForm.register('milesWantsToTravel')}
                        placeholder="e.g., 50 miles"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...addForm.register('description')}
                        placeholder="Inspector description"
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        {...addForm.register('notes')}
                        placeholder="Additional notes"
                        rows={4}
                      />
                    </div>
                  </>
                )}

                {/* Send Confirmation Checkbox */}
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                  <Checkbox
                    id="sendConfirmation"
                    checked={addForm.watch('sendConfirmation')}
                    onCheckedChange={(checked) => addForm.setValue('sendConfirmation', checked as boolean)}
                  />
                  <Label htmlFor="sendConfirmation" className="text-sm font-normal cursor-pointer leading-none">
                    Send confirmation link (user will set their own password)
                  </Label>
                </div>

                {/* Password Field (shown only if sendConfirmation is false) */}
                {!addForm.watch('sendConfirmation') && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        {...addForm.register('password')}
                        placeholder="••••••••"
                        className="pl-10"
                      />
                    </div>
                    {addForm.formState.errors.password && (
                      <p className="text-sm text-red-600">{addForm.formState.errors.password.message}</p>
                    )}
                  </div>
                )}

                {/* Permissions */}
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-semibold">Permissions</h3>
                  {(addType === 'inspector' ? inspectorPermissions : staffPermissions).map((perm) => (
                    <div key={perm.key} className="flex items-start space-x-2">
                      <div className="pt-0.5">
                        <Checkbox
                          id={perm.key}
                          checked={permissions[perm.key] || false}
                          onCheckedChange={(checked) => 
                            setPermissions({ ...permissions, [perm.key]: checked as boolean })
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Label 
                          htmlFor={perm.key} 
                          className="text-sm font-normal cursor-pointer leading-none"
                          title={perm.tooltip}
                        >
                          {perm.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">{perm.tooltip}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAddModal(false);
                      addForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Adding...' : `Add ${addType === 'inspector' ? 'Inspector' : 'Staff Member'}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Team Member Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-2xl w-full my-8 shadow-2xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit {editingMember.role === 'inspector' ? 'Inspector' : 'Staff Member'}
              </CardTitle>
              <CardDescription>
                Update team member details and permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto">
              <form onSubmit={editForm.handleSubmit(handleEditTeamMember)} className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-firstName">First Name *</Label>
                    <Input
                      id="edit-firstName"
                      {...editForm.register('firstName')}
                      placeholder="John"
                    />
                    {editForm.formState.errors.firstName && (
                      <p className="text-sm text-red-600">{editForm.formState.errors.firstName.message}</p>
                    )}
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="edit-lastName">Last Name *</Label>
                    <Input
                      id="edit-lastName"
                      {...editForm.register('lastName')}
                      placeholder="Doe"
                    />
                    {editForm.formState.errors.lastName && (
                      <p className="text-sm text-red-600">{editForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingMember.email}
                      disabled
                      className="pl-10 bg-gray-100"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phoneNumber">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-phoneNumber"
                      type="tel"
                      {...editForm.register('phoneNumber')}
                      placeholder="+1 (555) 000-0000"
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Inspector-only fields */}
                {editingMember.role === 'inspector' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-mobileNumber">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-mobileNumber"
                          type="tel"
                          {...editForm.register('mobileNumber')}
                          placeholder="+1 (555) 000-0000"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-credentials">Credentials</Label>
                      <Input
                        id="edit-credentials"
                        {...editForm.register('credentials')}
                        placeholder="e.g., Licensed Inspector, Certified Professional"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-homeAddress">Home Address</Label>
                      <Input
                        id="edit-homeAddress"
                        {...editForm.register('homeAddress')}
                        placeholder="Street address"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-city">City</Label>
                        <Input
                          id="edit-city"
                          {...editForm.register('city')}
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-state">State</Label>
                        <Input
                          id="edit-state"
                          {...editForm.register('state')}
                          placeholder="State"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-zipCode">Zip Code</Label>
                      <Input
                        id="edit-zipCode"
                        {...editForm.register('zipCode')}
                        placeholder="Zip code"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-milesWantsToTravel">Miles Willing to Travel</Label>
                      <Input
                        id="edit-milesWantsToTravel"
                        {...editForm.register('milesWantsToTravel')}
                        placeholder="e.g., 50 miles"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        {...editForm.register('description')}
                        placeholder="Inspector description"
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea
                        id="edit-notes"
                        {...editForm.register('notes')}
                        placeholder="Additional notes"
                        rows={4}
                      />
                    </div>
                  </>
                )}

                <ImageUpload
                  label="Profile Photo"
                  description="Used on team lists and assignments"
                  value={editForm.watch('profileImageUrl') || ''}
                  onChange={(url) => editForm.setValue('profileImageUrl', url ?? '')}
                />

                {editingMember.role === 'inspector' && (
                  <ImageUpload
                    label="Signature"
                    description="Inspector signature image"
                    value={editForm.watch('signatureImageUrl') || ''}
                    onChange={(url) => editForm.setValue('signatureImageUrl', url ?? '')}
                  />
                )}

                {/* Permissions */}
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-semibold">Permissions</h3>
                  {(editingMember.role === 'inspector' ? inspectorPermissions : staffPermissions).map((perm) => (
                    <div key={perm.key} className="flex items-start space-x-2">
                      <div className="pt-0.5">
                        <Checkbox
                          id={`edit-${perm.key}`}
                          checked={permissions[perm.key] || false}
                          onCheckedChange={(checked) => 
                            setPermissions({ ...permissions, [perm.key]: checked as boolean })
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Label 
                          htmlFor={`edit-${perm.key}`} 
                          className="text-sm font-normal cursor-pointer leading-none"
                          title={perm.tooltip}
                        >
                          {perm.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">{perm.tooltip}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingMember(null);
                      editForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold">
                {memberToDelete?.firstName} {memberToDelete?.lastName}
              </span>{' '}
              from your team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setMemberToDelete(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteTeamMember}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
