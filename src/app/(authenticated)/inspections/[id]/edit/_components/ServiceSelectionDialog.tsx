"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

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

interface ServiceSelectionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (selectedServices: Array<{
		serviceId: string;
		serviceName: string;
		addOns: Array<{ name: string; addFee?: number; addHours?: number }>;
	}>) => void;
	existingServices?: Array<{
		serviceId: string;
		serviceName: string;
		addOns?: Array<{ name: string; addFee?: number; addHours?: number }>;
	}>;
}

export default function ServiceSelectionDialog({
	open,
	onOpenChange,
	onSave,
	existingServices = [],
}: ServiceSelectionDialogProps) {
	const [services, setServices] = useState<Service[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
	const [selectedAddons, setSelectedAddons] = useState<Map<string, Set<string>>>(new Map());
	
	// Get existing service IDs
	const existingServiceIds = new Set(
		existingServices.map(s => {
			const id = typeof s.serviceId === 'string' ? s.serviceId : String(s.serviceId);
			return id;
		})
	);
	
	// Get existing addons for each service
	const existingAddonsMap = new Map<string, Set<string>>();
	existingServices.forEach(s => {
		const serviceId = typeof s.serviceId === 'string' ? s.serviceId : String(s.serviceId);
		const addonNames = new Set((s.addOns || []).map(a => a.name.toLowerCase()));
		existingAddonsMap.set(serviceId, addonNames);
	});

	useEffect(() => {
		if (open) {
			fetchServices();
			// Reset selections when dialog opens
			setSelectedServices(new Set());
			setSelectedAddons(new Map());
		}
	}, [open]);

	const fetchServices = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch('/api/services', { credentials: 'include' });
			if (!response.ok) {
				throw new Error('Failed to fetch services');
			}
			const data = await response.json();
			setServices(data.services || []);
		} catch (err: any) {
			console.error('Error fetching services:', err);
			setError(err.message || 'Failed to load services');
		} finally {
			setLoading(false);
		}
	};

	const handleServiceToggle = (serviceId: string, checked: boolean) => {
		const newSelectedServices = new Set(selectedServices);
		const newSelectedAddons = new Map(selectedAddons);

		if (checked) {
			newSelectedServices.add(serviceId);
		} else {
			newSelectedServices.delete(serviceId);
			// Clear addons for this service
			newSelectedAddons.delete(serviceId);
		}

		setSelectedServices(newSelectedServices);
		setSelectedAddons(newSelectedAddons);
	};

	const handleAddonToggle = (serviceId: string, addonName: string, checked: boolean) => {
		const newSelectedAddons = new Map(selectedAddons);
		const serviceAddons = newSelectedAddons.get(serviceId) || new Set<string>();

		if (checked) {
			serviceAddons.add(addonName);
		} else {
			serviceAddons.delete(addonName);
		}

		if (serviceAddons.size > 0) {
			newSelectedAddons.set(serviceId, serviceAddons);
		} else {
			newSelectedAddons.delete(serviceId);
		}

		setSelectedAddons(newSelectedAddons);
	};
	
	// Check if service already exists
	const isServiceExisting = (serviceId: string) => {
		return existingServiceIds.has(serviceId);
	};
	
	// Check if addon already exists for a service
	const isAddonExisting = (serviceId: string, addonName: string) => {
		const existingAddons = existingAddonsMap.get(serviceId);
		if (!existingAddons) return false;
		return existingAddons.has(addonName.toLowerCase());
	};

	const handleSave = () => {
		// Get addons for existing services (services that are not newly selected)
		const existingServicesAddons: Array<{
			serviceId: string;
			serviceName: string;
			addOns: Array<{ name: string; addFee?: number; addHours?: number }>;
		}> = [];
		
		existingServices.forEach(existingService => {
			const serviceId = typeof existingService.serviceId === 'string' 
				? existingService.serviceId 
				: String(existingService.serviceId);
			
			// Only process if this service has selected addons
			const serviceAddonNames = selectedAddons.get(serviceId);
			if (serviceAddonNames && serviceAddonNames.size > 0) {
				const service = services.find(s => s._id === serviceId);
				if (!service) return;
				
				const addOns = Array.from(serviceAddonNames).map(addonName => {
					const addon = service.addOns.find(a => a.name === addonName);
					if (!addon) return null;
					return {
						name: addon.name,
						addFee: addon.baseCost,
						addHours: addon.baseDurationHours,
					};
				}).filter(Boolean) as Array<{ name: string; addFee?: number; addHours?: number }>;
				
				if (addOns.length > 0) {
					existingServicesAddons.push({
						serviceId: service._id,
						serviceName: service.name,
						addOns,
					});
				}
			}
		});
		
		// Get newly selected services (not existing)
		const newServicesData = Array.from(selectedServices)
			.filter(serviceId => !existingServiceIds.has(serviceId))
			.map(serviceId => {
				const service = services.find(s => s._id === serviceId);
				if (!service) return null;

				const serviceAddonNames = selectedAddons.get(serviceId) || new Set<string>();
				const addOns = Array.from(serviceAddonNames).map(addonName => {
					const addon = service.addOns.find(a => a.name === addonName);
					if (!addon) return null;
					return {
						name: addon.name,
						addFee: addon.baseCost,
						addHours: addon.baseDurationHours,
					};
				}).filter(Boolean) as Array<{ name: string; addFee?: number; addHours?: number }>;

				return {
					serviceId: service._id,
					serviceName: service.name,
					addOns,
				};
			}).filter(Boolean) as Array<{
				serviceId: string;
				serviceName: string;
				addOns: Array<{ name: string; addFee?: number; addHours?: number }>;
			}>;

		// Combine existing services with addons and new services
		const allServicesData = [...existingServicesAddons, ...newServicesData];
		
		onSave(allServicesData);
		onOpenChange(false);
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[80vh]">
				<DialogHeader>
					<DialogTitle>Add Services</DialogTitle>
				</DialogHeader>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : error ? (
					<div className="text-center py-8">
						<p className="text-sm text-destructive">{error}</p>
						<Button onClick={fetchServices} className="mt-4" size="sm">
							Try Again
						</Button>
					</div>
				) : services.length === 0 ? (
					<div className="text-center py-8">
						<p className="text-sm text-muted-foreground">No services available</p>
					</div>
				) : (
					<div className="max-h-[50vh] overflow-y-auto pr-4">
						<div className="space-y-4">
							{services.map((service) => {
								const isServiceSelected = selectedServices.has(service._id);
								const serviceAddonNames = selectedAddons.get(service._id) || new Set<string>();
								const serviceExists = isServiceExisting(service._id);

								return (
									<div key={service._id} className={`border rounded-lg p-4 space-y-3 ${serviceExists ? 'bg-muted/30' : ''}`}>
										{/* Service Checkbox */}
										<div className="flex items-start gap-3">
											<Checkbox
												id={`service-${service._id}`}
												checked={isServiceSelected}
												disabled={serviceExists}
												onCheckedChange={(checked) => handleServiceToggle(service._id, checked as boolean)}
											/>
											<div className="flex-1">
												<Label
													htmlFor={`service-${service._id}`}
													className={`font-semibold text-base ${serviceExists ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}
												>
													{service.name}
													{serviceExists && (
														<span className="ml-2 text-xs text-muted-foreground">(Already added)</span>
													)}
												</Label>
												{service.addOns.length > 0 && (
													<div className="text-xs text-muted-foreground mt-1">
														{service.addOns.length} add-on{service.addOns.length > 1 ? 's' : ''} available
													</div>
												)}
											</div>
										</div>

										{/* Service Addons */}
										{service.addOns.length > 0 && (
											<div className="ml-8 space-y-2 border-l-2 border-muted pl-4">
												<p className="text-xs font-medium text-muted-foreground mb-2">Add-ons:</p>
												{service.addOns.map((addon) => {
													const isAddonChecked = serviceAddonNames.has(addon.name);
													const addonExists = isAddonExisting(service._id, addon.name);
													// Enable addons if service exists OR if service is selected
													const canSelectAddon = serviceExists || isServiceSelected;
													
													return (
														<div key={addon.name} className="flex items-start gap-3">
															<Checkbox
																id={`addon-${service._id}-${addon.name}`}
																checked={isAddonChecked}
																disabled={!canSelectAddon || addonExists}
																onCheckedChange={(checked) =>
																	handleAddonToggle(service._id, addon.name, checked as boolean)
																}
															/>
															<div className="flex-1">
																<Label
																	htmlFor={`addon-${service._id}-${addon.name}`}
																	className={`text-sm ${!canSelectAddon || addonExists ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer'}`}
																>
																	{addon.name}
																	{addonExists && (
																		<span className="ml-2 text-xs text-muted-foreground">(Already added)</span>
																	)}
																</Label>
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
					</div>
				)}

				<DialogFooter className="gap-2">
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={(selectedServices.size === 0 && Array.from(selectedAddons.values()).every(set => set.size === 0)) || loading}
					>
						{(() => {
							const newServicesCount = Array.from(selectedServices).filter(id => !existingServiceIds.has(id)).length;
							const addonsCount = Array.from(selectedAddons.values()).reduce((sum, set) => sum + set.size, 0);
							if (newServicesCount > 0 && addonsCount > 0) {
								return `Save (${newServicesCount} service${newServicesCount > 1 ? 's' : ''}, ${addonsCount} addon${addonsCount > 1 ? 's' : ''})`;
							} else if (newServicesCount > 0) {
								return `Save Services (${newServicesCount})`;
							} else if (addonsCount > 0) {
								return `Save Addons (${addonsCount})`;
							}
							return 'Save';
						})()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
