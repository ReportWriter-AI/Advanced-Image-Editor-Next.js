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
}

export default function ServiceSelectionDialog({
	open,
	onOpenChange,
	onSave,
}: ServiceSelectionDialogProps) {
	const [services, setServices] = useState<Service[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
	const [selectedAddons, setSelectedAddons] = useState<Map<string, Set<string>>>(new Map());

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

	const handleSave = () => {
		const selectedServicesData = Array.from(selectedServices).map(serviceId => {
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

		onSave(selectedServicesData);
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

								return (
									<div key={service._id} className="border rounded-lg p-4 space-y-3">
										{/* Service Checkbox */}
										<div className="flex items-start gap-3">
											<Checkbox
												id={`service-${service._id}`}
												checked={isServiceSelected}
												onCheckedChange={(checked) => handleServiceToggle(service._id, checked as boolean)}
											/>
											<div className="flex-1">
												<Label
													htmlFor={`service-${service._id}`}
													className="font-semibold text-base cursor-pointer"
												>
													{service.name}
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
													return (
														<div key={addon.name} className="flex items-start gap-3">
															<Checkbox
																id={`addon-${service._id}-${addon.name}`}
																checked={isAddonChecked}
																disabled={!isServiceSelected}
																onCheckedChange={(checked) =>
																	handleAddonToggle(service._id, addon.name, checked as boolean)
																}
															/>
															<div className="flex-1">
																<Label
																	htmlFor={`addon-${service._id}-${addon.name}`}
																	className={`text-sm cursor-pointer ${!isServiceSelected ? 'text-muted-foreground' : ''}`}
																>
																	{addon.name}
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
						disabled={selectedServices.size === 0 || loading}
					>
						Save Services ({selectedServices.size})
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
