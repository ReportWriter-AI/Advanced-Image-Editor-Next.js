"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AsyncSelect from 'react-select/async';
import AsyncCreatableSelect from 'react-select/async-creatable';
import CreatableSelect from 'react-select/creatable';
import { ImageUpload } from '@/components/ui/image-upload';

// Helper function to check if a string is a valid MongoDB ObjectId
const isValidObjectId = (str: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(str);
};

interface AgentData {
  firstName: string;
  lastName: string;
  email: string;
  ccEmail: string;
  phone: string;
  agency?: string;
  photoUrl?: string;
  categories: string[];
  notes: string;
  privateNotes: string;
}

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (agentData: AgentData) => Promise<void>;
  title?: string;
}

export default function AddAgentDialog({ open, onOpenChange, onSave, title = "Add Agent" }: AddAgentDialogProps) {
  const [agentData, setAgentData] = useState<AgentData>({
    firstName: '',
    lastName: '',
    email: '',
    ccEmail: '',
    phone: '',
    agency: undefined,
    photoUrl: undefined,
    categories: [],
    notes: '',
    privateNotes: '',
  });
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadAgentOptions = async (inputValue: string) => {
    if (!inputValue || inputValue.length < 2) {
      return [];
    }

    try {
      const response = await fetch(
        `/api/agents/search?search=${encodeURIComponent(inputValue)}&limit=20`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const agentsList = data.agents || [];

      return agentsList.map((a: any) => {
        const displayName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unnamed Agent';
        return {
          value: a._id,
          label: displayName,
          agent: a,
        };
      });
    } catch (error) {
      console.error('Error loading agents:', error);
      return [];
    }
  };

  const handleAgentSelect = (selectedOption: any) => {
    if (!selectedOption || !selectedOption.agent) return;

    const selectedAgent = selectedOption.agent;
    
    // Extract agency ID and cache agency name if available
    const agencyId = selectedAgent.agency?._id?.toString() || selectedAgent.agency || undefined;
    if (agencyId && selectedAgent.agency?.name) {
      // Cache the agency name for immediate display
      setAgencyNames(prev => ({
        ...prev,
        [agencyId]: selectedAgent.agency.name,
      }));
    }
    
    setAgentData({
      firstName: selectedAgent.firstName || '',
      lastName: selectedAgent.lastName || '',
      email: selectedAgent.email || '',
      ccEmail: selectedAgent.ccEmail || '',
      phone: selectedAgent.phone || '',
      agency: agencyId,
      photoUrl: selectedAgent.photoUrl || undefined,
      categories: (selectedAgent.categories || []).map((category: any) => 
        typeof category === 'string' ? category : category.name || category
      ) || [],
      notes: selectedAgent.internalNotes || '',
      privateNotes: selectedAgent.internalAdminNotes || '',
    });
  };

  const handleSave = async () => {
    if (!agentData.email?.trim()) {
      alert('Email is required');
      return;
    }

    setSaving(true);
    try {
      await onSave(agentData);
      // Reset form
      setAgentData({
        firstName: '',
        lastName: '',
        email: '',
        ccEmail: '',
        phone: '',
        agency: undefined,
        photoUrl: undefined,
        categories: [],
        notes: '',
        privateNotes: '',
      });
      setAgencyNames({});
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving agent:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setAgentData({
        firstName: '',
        lastName: '',
        email: '',
        ccEmail: '',
        phone: '',
        agency: undefined,
        photoUrl: undefined,
        categories: [],
        notes: '',
        privateNotes: '',
      });
      setAgencyNames({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Search Existing Agent</Label>
            <AsyncSelect
              loadOptions={loadAgentOptions}
              onChange={handleAgentSelect}
              placeholder="Type to search for existing agent..."
              isClearable
              noOptionsMessage={({ inputValue }) =>
                inputValue.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No agents found'
              }
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={agentData.firstName}
                onChange={(e) => setAgentData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={agentData.lastName}
                onChange={(e) => setAgentData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={agentData.email}
                onChange={(e) => setAgentData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccEmail">CC Email</Label>
              <Input
                id="ccEmail"
                type="email"
                value={agentData.ccEmail}
                onChange={(e) => setAgentData(prev => ({ ...prev, ccEmail: e.target.value }))}
                placeholder="CC email..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={agentData.phone}
              onChange={(e) => setAgentData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone..."
            />
          </div>

          <div className="space-y-2">
            <Label>Agency</Label>
            <AsyncCreatableSelect
              cacheOptions
              value={(() => {
                const agencyValue = agentData.agency;
                if (!agencyValue) return null;
                
                // If it's a valid ObjectId, it's an existing agency
                if (isValidObjectId(String(agencyValue))) {
                  const cachedName = agencyNames[String(agencyValue)];
                  return { 
                    value: String(agencyValue), 
                    label: cachedName || 'Loading...' 
                  };
                } else {
                  // It's a new agency name (string)
                  return { 
                    value: String(agencyValue), 
                    label: String(agencyValue) 
                  };
                }
              })()}
              onChange={async (option: any, actionMeta: any) => {
                if (actionMeta.action === 'create-option') {
                  // Store the new agency name as a string (will be created on form submit)
                  setAgentData(prev => ({
                    ...prev,
                    agency: option.value.trim(), // Store as string name, not ID
                  }));
                } else if (actionMeta.action === 'select-option') {
                  // Select existing agency (store as ID)
                  // Cache the agency name
                  if (option?.label) {
                    setAgencyNames(prev => ({
                      ...prev,
                      [option.value]: option.label,
                    }));
                  }
                  
                  setAgentData(prev => ({
                    ...prev,
                    agency: option?.value || undefined,
                  }));
                } else if (actionMeta.action === 'clear') {
                  // Clear selection
                  setAgentData(prev => ({
                    ...prev,
                    agency: undefined,
                  }));
                }
              }}
              loadOptions={async (inputValue: string) => {
                try {
                  const search = inputValue || '';
                  const response = await fetch(
                    `/api/agencies/search?search=${encodeURIComponent(search)}&limit=20`,
                    { credentials: 'include' }
                  );

                  if (!response.ok) {
                    return [];
                  }

                  const data = await response.json();
                  const agenciesList = data.agencies || [];

                  const options = agenciesList.map((a: any) => {
                    const agencyId = a._id || a.id;
                    const agencyName = a.name;
                    
                    // Cache agency names
                    setAgencyNames(prev => ({
                      ...prev,
                      [agencyId]: agencyName,
                    }));
                    
                    return {
                      value: agencyId,
                      label: agencyName,
                    };
                  });

                  return options;
                } catch (error) {
                  console.error('Error loading agencies:', error);
                  return [];
                }
              }}
              defaultOptions
              isClearable
              placeholder="Search or create agency by name..."
              noOptionsMessage={({ inputValue }) =>
                inputValue
                  ? `No agencies found. Press Enter to create "${inputValue}"`
                  : 'Type to search agencies...'
              }
              className="react-select-container"
              classNamePrefix="react-select"
              formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
            />
          </div>

          <div className="space-y-2">
            <Label>Photo</Label>
            <ImageUpload
              value={agentData.photoUrl || null}
              onChange={(url) => setAgentData(prev => ({ ...prev, photoUrl: url || undefined }))}
              shape="rounded"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categories">Categories</Label>
            <CreatableSelect
              isMulti
              value={(agentData.categories || []).map(category => ({ value: category, label: category }))}
              onChange={(selectedOptions) => {
                setAgentData(prev => ({
                  ...prev,
                  categories: selectedOptions.map(opt => opt.value),
                }));
              }}
              onCreateOption={(inputValue) => {
                setAgentData(prev => {
                  const currentCategories = prev.categories || [];
                  if (!currentCategories.includes(inputValue.trim())) {
                    return {
                      ...prev,
                      categories: [...currentCategories, inputValue.trim()],
                    };
                  }
                  return prev;
                });
              }}
              placeholder="Type and press Enter to add categories..."
              className="react-select-container"
              classNamePrefix="react-select"
              formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={agentData.notes}
                onChange={(e) => setAgentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privateNotes">Private Notes</Label>
              <Textarea
                id="privateNotes"
                value={agentData.privateNotes}
                onChange={(e) => setAgentData(prev => ({ ...prev, privateNotes: e.target.value }))}
                placeholder="Private notes..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !agentData.email?.trim()}>
            {saving ? 'Saving...' : 'Add Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

