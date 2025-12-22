"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import AsyncSelect from 'react-select/async';
import CreatableSelect from 'react-select/creatable';

interface ClientData {
  isCompany: boolean;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  ccEmail: string;
  phone: string;
  categories: string[];
  notes: string;
  privateNotes: string;
}

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (clientData: ClientData) => Promise<void>;
}

export default function AddClientDialog({ open, onOpenChange, onSave }: AddClientDialogProps) {
  const [clientData, setClientData] = useState<ClientData>({
    isCompany: false,
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    ccEmail: '',
    phone: '',
    categories: [],
    notes: '',
    privateNotes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadClientOptions = async (inputValue: string) => {
    if (!inputValue || inputValue.length < 2) {
      return [];
    }

    try {
      const response = await fetch(
        `/api/clients?search=${encodeURIComponent(inputValue)}&limit=20`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const clientsList = data.clients || [];

      return clientsList.map((c: any) => {
        const displayName = c.isCompany
          ? c.companyName || 'Unnamed Company'
          : `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Client';
        
        return {
          value: c._id,
          label: displayName,
          client: c,
        };
      });
    } catch (error) {
      console.error('Error loading clients:', error);
      return [];
    }
  };

  const handleClientSelect = (selectedOption: any) => {
    if (!selectedOption || !selectedOption.client) return;

    const selectedClient = selectedOption.client;
    setClientData({
      isCompany: selectedClient.isCompany || false,
      firstName: selectedClient.firstName || '',
      lastName: selectedClient.lastName || '',
      companyName: selectedClient.companyName || '',
      email: selectedClient.email || '',
      ccEmail: selectedClient.ccEmail || '',
      phone: selectedClient.phone || '',
      categories: (selectedClient.categories || []).map((category: any) => 
        typeof category === 'string' ? category : category.name || category
      ),
      notes: selectedClient.internalNotes || '',
      privateNotes: selectedClient.internalAdminNotes || '',
    });
  };

  const handleSave = async () => {
    if (!clientData.email?.trim()) {
      alert('Email is required');
      return;
    }

    setSaving(true);
    try {
      await onSave(clientData);
      // Reset form
      setClientData({
        isCompany: false,
        firstName: '',
        lastName: '',
        companyName: '',
        email: '',
        ccEmail: '',
        phone: '',
        categories: [],
        notes: '',
        privateNotes: '',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving client:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setClientData({
        isCompany: false,
        firstName: '',
        lastName: '',
        companyName: '',
        email: '',
        ccEmail: '',
        phone: '',
        categories: [],
        notes: '',
        privateNotes: '',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Search Existing Client</Label>
            <AsyncSelect
              loadOptions={loadClientOptions}
              onChange={handleClientSelect}
              placeholder="Type to search for existing client..."
              isClearable
              noOptionsMessage={({ inputValue }) =>
                inputValue.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No clients found'
              }
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isCompany"
              checked={clientData.isCompany}
              onCheckedChange={(checked) => {
                setClientData(prev => ({
                  ...prev,
                  isCompany: checked === true,
                  firstName: checked ? '' : prev.firstName,
                  lastName: checked ? '' : prev.lastName,
                  companyName: checked ? prev.companyName : '',
                }));
              }}
            />
            <Label htmlFor="isCompany" className="text-sm font-normal cursor-pointer">
              Client is a Company/Organization
            </Label>
          </div>

          {clientData.isCompany ? (
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={clientData.companyName}
                onChange={(e) => setClientData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Company name..."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={clientData.firstName}
                  onChange={(e) => setClientData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={clientData.lastName}
                  onChange={(e) => setClientData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name..."
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={clientData.email}
                onChange={(e) => setClientData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccEmail">CC Email</Label>
              <Input
                id="ccEmail"
                type="email"
                value={clientData.ccEmail}
                onChange={(e) => setClientData(prev => ({ ...prev, ccEmail: e.target.value }))}
                placeholder="CC email..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={clientData.phone}
              onChange={(e) => setClientData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categories">Categories</Label>
            <CreatableSelect
              isMulti
              value={(clientData.categories || []).map(category => ({ value: category, label: category }))}
              onChange={(selectedOptions) => {
                setClientData(prev => ({
                  ...prev,
                  categories: selectedOptions.map(opt => opt.value),
                }));
              }}
              onCreateOption={(inputValue) => {
                setClientData(prev => {
                  const newCategories = [...(prev.categories || [])];
                  if (!newCategories.includes(inputValue.trim())) {
                    newCategories.push(inputValue.trim());
                  }
                  return { ...prev, categories: newCategories };
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
                value={clientData.notes}
                onChange={(e) => setClientData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privateNotes">Private Notes</Label>
              <Textarea
                id="privateNotes"
                value={clientData.privateNotes}
                onChange={(e) => setClientData(prev => ({ ...prev, privateNotes: e.target.value }))}
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
          <Button onClick={handleSave} disabled={saving || !clientData.email?.trim()}>
            {saving ? 'Saving...' : 'Add Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

