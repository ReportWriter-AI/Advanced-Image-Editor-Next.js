"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PricingItem {
  type: 'service' | 'addon' | 'additional';
  serviceId?: string;
  addonName?: string;
  name: string;
  price: number;
  originalPrice?: number;
  hours?: number;
}

interface Service {
  _id: string;
  name: string;
  baseCost: number;
  baseDurationHours: number;
  addOns: Array<{
    name: string;
    baseCost: number;
    baseDurationHours: number;
  }>;
}

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    baseCost?: number;
    addOns?: Array<{ name: string; addFee?: number; addHours?: number }>;
  }>;
  pricing?: {
    items: PricingItem[];
  } | null;
  onPricingUpdated?: () => void;
}

export default function PricingModal({
  open,
  onOpenChange,
  inspectionId,
  services,
  pricing,
  onPricingUpdated,
}: PricingModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [newCustomItemName, setNewCustomItemName] = useState('');
  const [newCustomItemPrice, setNewCustomItemPrice] = useState('');

  // Initialize pricing items when modal opens
  useEffect(() => {
    if (open) {
      if (pricing && pricing.items && pricing.items.length > 0) {
        // Use existing pricing items
        setPricingItems([...pricing.items]);
      } else {
        // Initialize from services
        const items: PricingItem[] = [];
        
        for (const service of services) {
          const serviceId = typeof service.serviceId === 'string' 
            ? service.serviceId 
            : String(service.serviceId);
          
          // Add service item
          items.push({
            type: 'service',
            serviceId: serviceId,
            name: service.serviceName || 'Service',
            price: service.baseCost || 0,
            originalPrice: service.baseCost || 0,
          });

          // Add addon items
          if (service.addOns && Array.isArray(service.addOns)) {
            for (const addon of service.addOns) {
              items.push({
                type: 'addon',
                serviceId: serviceId,
                addonName: addon.name,
                name: addon.name,
                price: addon.addFee || 0,
                originalPrice: addon.addFee || 0,
                hours: addon.addHours,
              });
            }
          }
        }
        
        setPricingItems(items);
      }
      setNewCustomItemName('');
      setNewCustomItemPrice('');
    }
  }, [open, pricing, services]);

  const updateItemPrice = (index: number, price: number) => {
    const updated = [...pricingItems];
    updated[index] = {
      ...updated[index],
      price: Math.max(0, price),
    };
    setPricingItems(updated);
  };

  const addCustomItem = () => {
    const name = newCustomItemName.trim();
    const price = parseFloat(newCustomItemPrice);

    if (!name) {
      toast.error('Please enter a name for the custom item');
      return;
    }

    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const newItem: PricingItem = {
      type: 'additional',
      name: name,
      price: price,
    };

    setPricingItems([...pricingItems, newItem]);
    setNewCustomItemName('');
    setNewCustomItemPrice('');
  };

  const removeCustomItem = (index: number) => {
    const item = pricingItems[index];
    if (item.type === 'additional') {
      const updated = pricingItems.filter((_, i) => i !== index);
      setPricingItems(updated);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          items: pricingItems,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update pricing');
      }

      toast.success('Pricing updated successfully');
      onPricingUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      toast.error(error.message || 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  // Group items by service for hierarchical display
  const groupedItems: {
    service: PricingItem | null;
    addons: PricingItem[];
    additional: PricingItem[];
  } = {
    service: null,
    addons: [],
    additional: [],
  };

  const serviceItems: PricingItem[] = [];
  const addonMap = new Map<string, PricingItem[]>();

  for (const item of pricingItems) {
    if (item.type === 'service') {
      serviceItems.push(item);
      addonMap.set(item.serviceId || '', []);
    } else if (item.type === 'addon' && item.serviceId) {
      const serviceId = item.serviceId;
      if (!addonMap.has(serviceId)) {
        addonMap.set(serviceId, []);
      }
      addonMap.get(serviceId)!.push(item);
    } else if (item.type === 'additional') {
      groupedItems.additional.push(item);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Pricing</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Services with nested addons */}
          {serviceItems.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Services & Add-ons</h3>
              {serviceItems.map((serviceItem) => {
                const serviceId = serviceItem.serviceId || '';
                const addons = addonMap.get(serviceId) || [];
                
                return (
                  <div key={serviceId} className="space-y-2 border rounded-lg p-4">
                    {/* Service */}
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">{serviceItem.name}</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={serviceItem.price}
                          onChange={(e) => updateItemPrice(
                            pricingItems.findIndex(i => i === serviceItem),
                            parseFloat(e.target.value) || 0
                          )}
                          className="w-24"
                        />
                      </div>
                    </div>

                    {/* Addons nested under service */}
                    {addons.length > 0 && (
                      <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                        {addons.map((addonItem) => {
                          const addonIndex = pricingItems.findIndex(i => i === addonItem);
                          return (
                            <div key={addonIndex} className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">
                                {addonItem.name}
                              </Label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={addonItem.price}
                                  onChange={(e) => updateItemPrice(
                                    addonIndex,
                                    parseFloat(e.target.value) || 0
                                  )}
                                  className="w-24"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Additional custom items */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Additional Items</h3>
            
            {groupedItems.additional.length > 0 && (
              <div className="space-y-2">
                {groupedItems.additional.map((item, index) => {
                  const itemIndex = pricingItems.findIndex(i => i === item);
                  return (
                    <div key={itemIndex} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="font-medium">{item.name}</Label>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItemPrice(
                              itemIndex,
                              parseFloat(e.target.value) || 0
                            )}
                            className="w-24"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomItem(itemIndex)}
                        className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new custom item */}
            <div className="flex items-center gap-2 border rounded-lg p-3">
              <Input
                placeholder="Item name"
                value={newCustomItemName}
                onChange={(e) => setNewCustomItemName(e.target.value)}
                className="flex-1"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newCustomItemPrice}
                  onChange={(e) => setNewCustomItemPrice(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addCustomItem}
                className="ml-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

