import mongoose from 'mongoose';

import Service, { IService, IServiceAddOn } from '@/src/models/Service';
import { DiscountCodeType, IDiscountCode } from '@/src/models/DiscountCode';

interface DiscountCodeAddOnInput {
  serviceId?: unknown;
  addOnOrderIndex?: unknown;
  addOnName?: unknown;
}

export interface DiscountCodePayloadInput {
  code?: unknown;
  type?: unknown;
  value?: unknown;
  description?: unknown;
  notes?: unknown;
  appliesToServices?: unknown;
  appliesToAddOns?: unknown;
  maxUses?: unknown;
  expirationDate?: unknown;
  active?: unknown;
}

export interface SanitizedDiscountCodePayload {
  code?: string;
  type?: DiscountCodeType;
  value?: number;
  description?: string;
  notes?: string;
  appliesToServices?: mongoose.Types.ObjectId[];
  appliesToAddOns?: {
    service: mongoose.Types.ObjectId;
    addOnName: string;
    addOnOrderIndex?: number;
  }[];
  maxUses?: number | null;
  expirationDate?: Date | null;
  active?: boolean;
}

interface SanitizeOptions {
  requireCode?: boolean;
  requireType?: boolean;
  requireValue?: boolean;
}

type ServiceForValidation = Pick<IService, '_id' | 'name'> & {
  addOns?: Pick<IServiceAddOn, 'name' | 'orderIndex'>[];
};

function toNonEmptyString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export async function sanitizeDiscountCodePayload(
  payload: DiscountCodePayloadInput,
  companyId?: mongoose.Types.ObjectId,
  options: SanitizeOptions = {}
): Promise<{ data?: SanitizedDiscountCodePayload; error?: string }> {
  if (!companyId) {
    return { error: 'No company associated with current user' };
  }

  const data: SanitizedDiscountCodePayload = {};

  if (payload.code !== undefined || options.requireCode) {
    const code = toNonEmptyString(payload.code);
    if (!code) {
      return { error: 'Discount code is required' };
    }
    data.code = code;
  }

  if (payload.type !== undefined || options.requireType) {
    if (payload.type !== 'percent' && payload.type !== 'amount') {
      return { error: 'Discount type must be either Percent or Amount' };
    }
    data.type = payload.type;
  }

  if (payload.value !== undefined || options.requireValue) {
    const parsedValue = parseNumber(payload.value);
    if (parsedValue === undefined || parsedValue < 0) {
      return { error: 'Amount or percentage must be a non-negative number' };
    }
    data.value = parsedValue;
  }

  if (payload.description !== undefined) {
    const description = toNonEmptyString(payload.description);
    if (description) {
      data.description = description;
    } else {
      data.description = undefined;
    }
  }

  if (payload.notes !== undefined) {
    const notes = toNonEmptyString(payload.notes);
    if (notes) {
      data.notes = notes;
    } else {
      data.notes = undefined;
    }
  }

  if (payload.active !== undefined) {
    data.active = Boolean(payload.active);
  }

  if (payload.maxUses !== undefined) {
    if (payload.maxUses === null || payload.maxUses === '') {
      data.maxUses = null;
    } else {
      const parsedMaxUses = parseNumber(payload.maxUses);
      if (parsedMaxUses === undefined || parsedMaxUses < 0 || !Number.isInteger(parsedMaxUses)) {
        return { error: 'Max uses must be a whole number greater than or equal to 0' };
      }
      data.maxUses = parsedMaxUses;
    }
  }

  if (payload.expirationDate !== undefined) {
    if (payload.expirationDate === null || payload.expirationDate === '') {
      data.expirationDate = null;
    } else {
      const expiration =
        payload.expirationDate instanceof Date
          ? payload.expirationDate
          : new Date(String(payload.expirationDate));
      if (Number.isNaN(expiration.getTime())) {
        return { error: 'Expiration date is invalid' };
      }
      data.expirationDate = expiration;
    }
  }

  const servicesField = Array.isArray(payload.appliesToServices) ? payload.appliesToServices : undefined;
  const addOnsField = Array.isArray(payload.appliesToAddOns) ? payload.appliesToAddOns : undefined;

  const serviceIdsFromServices = servicesField
    ? servicesField
        .map((value) => (typeof value === 'string' ? value : undefined))
        .filter((id): id is string => Boolean(id))
    : [];

  const serviceIdsFromAddOns = addOnsField
    ? addOnsField
        .map((entry) =>
          entry && typeof entry === 'object' && typeof (entry as DiscountCodeAddOnInput).serviceId === 'string'
            ? (entry as DiscountCodeAddOnInput).serviceId
            : undefined
        )
        .filter((id): id is string => Boolean(id))
    : [];

  const serviceIdsToFetch = Array.from(new Set([...serviceIdsFromServices, ...serviceIdsFromAddOns])).filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  let serviceMap = new Map<string, ServiceForValidation>();
  if (serviceIdsToFetch.length > 0) {
    const serviceObjectIds = serviceIdsToFetch.map((id) => new mongoose.Types.ObjectId(id));
    const services = await Service.find({
      _id: { $in: serviceObjectIds },
      company: companyId,
    })
      .select('_id name addOns')
      .lean<ServiceForValidation[]>();
    serviceMap = new Map(services.map((service) => [service._id.toString(), service]));
  }

  if (payload.appliesToServices !== undefined) {
    if (!Array.isArray(payload.appliesToServices)) {
      return { error: 'Applies to services must be an array' };
    }
    const sanitizedServices: mongoose.Types.ObjectId[] = [];
    const seen = new Set<string>();
    for (const entry of payload.appliesToServices) {
      const id = typeof entry === 'string' ? entry : undefined;
      if (!id || !mongoose.Types.ObjectId.isValid(id) || seen.has(id)) {
        continue;
      }
      const serviceDoc = serviceMap.get(id);
      if (!serviceDoc) {
        continue;
      }
      seen.add(id);
      sanitizedServices.push(new mongoose.Types.ObjectId(id));
    }
    data.appliesToServices = sanitizedServices;
  }

  if (payload.appliesToAddOns !== undefined) {
    if (!Array.isArray(payload.appliesToAddOns)) {
      return { error: 'Applies to add-ons must be an array' };
    }

    const sanitizedAddOns: NonNullable<SanitizedDiscountCodePayload['appliesToAddOns']> = [];
    const seenAddOns = new Set<string>();

    for (const entry of payload.appliesToAddOns) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const raw = entry as DiscountCodeAddOnInput;
      const serviceId = typeof raw.serviceId === 'string' ? raw.serviceId : undefined;
      if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
        continue;
      }
      const serviceDoc = serviceMap.get(serviceId);
      if (!serviceDoc || !Array.isArray(serviceDoc.addOns)) {
        continue;
      }

      const orderIndex = parseNumber(raw.addOnOrderIndex);
      const requestedName = toNonEmptyString(raw.addOnName);

      const matchedAddOn =
        serviceDoc.addOns.find((addOn) => orderIndex !== undefined && addOn.orderIndex === orderIndex) ||
        serviceDoc.addOns.find((addOn) =>
          requestedName ? addOn.name.toLowerCase() === requestedName.toLowerCase() : false
        );

      if (!matchedAddOn) {
        continue;
      }

      const key = `${serviceId}:${matchedAddOn.orderIndex ?? matchedAddOn.name}`;
      if (seenAddOns.has(key)) {
        continue;
      }
      seenAddOns.add(key);

      sanitizedAddOns.push({
        service: new mongoose.Types.ObjectId(serviceId),
        addOnName: matchedAddOn.name,
        ...(matchedAddOn.orderIndex !== undefined ? { addOnOrderIndex: matchedAddOn.orderIndex } : {}),
      });
    }

    data.appliesToAddOns = sanitizedAddOns;
  }

  return { data };
}

export interface DiscountCodeServiceDetail {
  serviceId: string;
  serviceName: string | null;
}

export interface DiscountCodeAddOnDetail extends DiscountCodeServiceDetail {
  addOnName: string;
  addOnOrderIndex: number | null;
}

export type DiscountCodeWithRelations = mongoose.LeanDocument<IDiscountCode> & {
  appliesToServicesDetails: DiscountCodeServiceDetail[];
  appliesToAddOnsDetails: DiscountCodeAddOnDetail[];
};

export async function withDiscountCodeRelations(
  codes: mongoose.LeanDocument<IDiscountCode>[]
): Promise<DiscountCodeWithRelations[]> {
  if (codes.length === 0) {
    return [];
  }

  const serviceIds = new Set<string>();
  codes.forEach((code) => {
    (code.appliesToServices ?? []).forEach((serviceId) => serviceIds.add(serviceId.toString()));
    (code.appliesToAddOns ?? []).forEach((entry) => serviceIds.add(entry.service.toString()));
  });

  let serviceNameMap = new Map<string, string>();
  if (serviceIds.size > 0) {
    const serviceObjectIds = Array.from(serviceIds)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (serviceObjectIds.length > 0) {
      const services = await Service.find({ _id: { $in: serviceObjectIds } })
        .select('_id name')
        .lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
      serviceNameMap = new Map(services.map((service) => [service._id.toString(), service.name]));
    }
  }

  return codes.map((code) => ({
    ...code,
    appliesToServicesDetails: (code.appliesToServices ?? []).map((serviceId) => ({
      serviceId: serviceId.toString(),
      serviceName: serviceNameMap.get(serviceId.toString()) ?? null,
    })),
    appliesToAddOnsDetails: (code.appliesToAddOns ?? []).map((entry) => ({
      serviceId: entry.service.toString(),
      serviceName: serviceNameMap.get(entry.service.toString()) ?? null,
      addOnName: entry.addOnName,
      addOnOrderIndex: entry.addOnOrderIndex ?? null,
    })),
  }));
}


