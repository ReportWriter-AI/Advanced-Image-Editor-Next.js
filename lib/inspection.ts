// lib/inspection.ts
import dbConnect from "./db";
import Inspection, { IInspection } from "@/src/models/Inspection";
import mongoose from "mongoose";
import Client from "@/src/models/Client";
import Agent from "@/src/models/Agent";
import { IUser } from "@/src/models/User";
import { IDiscountCode } from "@/src/models/DiscountCode";

type CreateInspectionParams = {
  companyId: string;
  status?: string;
  date?: string | Date;
  createdBy?: string;
  inspector?: string;
  companyOwnerRequested?: boolean;
  services?: Array<{
    serviceId: string;
    addOns?: Array<{
      name: string;
      addFee?: number;
      addHours?: number;
    }>;
  }>;
  discountCode?: string;
  location?: {
    address?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    squareFeet?: number;
    yearBuild?: number;
    foundation?: 'Basement' | 'Slab' | 'Crawlspace';
  };
  requirePaymentToReleaseReports?: boolean;
  paymentNotes?: string;
  orderId?: number;
  referralSource?: string;
  confirmedInspection?: boolean;
  disableAutomatedNotifications?: boolean;
  internalNotes?: string;
  clientNote?: string;
  clientAgreedToTerms?: boolean;
  token?: string;
  customData?: Record<string, any>;
};

const formatInspection = (doc: IInspection | null) => {
  if (!doc) return null;
  
  // Format client names
  const formatClientName = (client: any): string => {
    if (!client) return '';
    if (typeof client === 'string') return ''; // If it's just an ID, return empty
    if (client.isCompany) {
      return client.companyName || '';
    }
    const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    return name || '';
  };

  // Format agent names
  const formatAgentName = (agent: any): string => {
    if (!agent) return '';
    if (typeof agent === 'string') return ''; // If it's just an ID, return empty
    const name = `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
    return name || '';
  };

  // Format clients array
  const formattedClients = doc.clients && Array.isArray(doc.clients)
    ? doc.clients.map((client: any) => {
        if (typeof client === 'object' && client !== null) {
          return {
            _id: client._id?.toString() || client.toString(),
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            companyName: client.companyName || '',
            isCompany: client.isCompany || false,
            email: client.email || '',
            phone: client.phone || '',
            formattedName: formatClientName(client),
          };
        }
        return {
          _id: client?.toString() || '',
          formattedName: '',
        };
      })
    : [];

  // Format agents array
  const formattedAgents = doc.agents && Array.isArray(doc.agents)
    ? doc.agents.map((agent: any) => {
        if (typeof agent === 'object' && agent !== null) {
          return {
            _id: agent._id?.toString() || agent.toString(),
            firstName: agent.firstName || '',
            lastName: agent.lastName || '',
            email: agent.email || '',
            phone: agent.phone || '',
            photoUrl: agent.photoUrl || '',
            formattedName: formatAgentName(agent),
          };
        }
        return {
          _id: agent?.toString() || '',
          formattedName: '',
        };
      })
    : [];

  // Format listingAgent array (handle both singular and array)
  const listingAgentField = (doc as any).listingAgent;
  const formattedListingAgents = listingAgentField
    ? (Array.isArray(listingAgentField)
        ? listingAgentField.map((agent: any) => {
            if (typeof agent === 'object' && agent !== null) {
              return {
                _id: agent._id?.toString() || agent.toString(),
                firstName: agent.firstName || '',
                lastName: agent.lastName || '',
                email: agent.email || '',
                phone: agent.phone || '',
                photoUrl: agent.photoUrl || '',
                formattedName: formatAgentName(agent),
              };
            }
            return {
              _id: agent?.toString() || '',
              formattedName: '',
            };
          })
        : [{
            _id: listingAgentField._id?.toString() || listingAgentField.toString(),
            firstName: listingAgentField.firstName || '',
            lastName: listingAgentField.lastName || '',
            email: listingAgentField.email || '',
            phone: listingAgentField.phone || '',
            photoUrl: listingAgentField.photoUrl || '',
            formattedName: formatAgentName(listingAgentField),
          }])
    : [];

  // Format inspector (could be populated or just an ID)
  const inspectorDoc = doc.inspector as IUser | mongoose.Types.ObjectId | undefined;
  const formattedInspector = inspectorDoc && typeof inspectorDoc === 'object' && '_id' in inspectorDoc
    ? {
        _id: inspectorDoc._id?.toString() || '',
        firstName: (inspectorDoc as IUser).firstName || '',
        lastName: (inspectorDoc as IUser).lastName || '',
        email: (inspectorDoc as IUser).email || '',
        phone: (inspectorDoc as IUser).phoneNumber || '',
        photoUrl: (inspectorDoc as IUser).profileImageUrl || '',
      }
    : null;

  // Format discount code (could be populated or just an ID)
  const discountCodeDoc = doc.discountCode as IDiscountCode | mongoose.Types.ObjectId | undefined;
  const formattedDiscountCode = discountCodeDoc && typeof discountCodeDoc === 'object' && '_id' in discountCodeDoc
    ? {
        _id: discountCodeDoc._id?.toString() || '',
        code: (discountCodeDoc as IDiscountCode).code || '',
        type: (discountCodeDoc as IDiscountCode).type || '',
        value: (discountCodeDoc as IDiscountCode).value || 0,
        active: (discountCodeDoc as IDiscountCode).active ?? false,
      }
    : null;

  // Format office notes (sort by newest first)
  const formattedOfficeNotes = doc.officeNotes && Array.isArray(doc.officeNotes)
    ? doc.officeNotes
        .map((note: any) => {
          if (!note) return null;
          
          const createdBy = note.createdBy && typeof note.createdBy === 'object'
            ? {
                _id: note.createdBy._id?.toString() || '',
                firstName: note.createdBy.firstName || '',
                lastName: note.createdBy.lastName || '',
                profileImageUrl: note.createdBy.profileImageUrl || '',
              }
            : null;

          return {
            _id: note._id?.toString() || '',
            content: note.content || '',
            createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
            createdBy,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          // Sort by createdAt descending (newest first)
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
    : [];

  // Format services with populated service names
  const formattedServices = doc.services && Array.isArray(doc.services)
    ? doc.services.map((service: any) => {
        const serviceId = service.serviceId && typeof service.serviceId === 'object'
          ? service.serviceId._id?.toString()
          : service.serviceId?.toString();
        const serviceName = service.serviceId && typeof service.serviceId === 'object'
          ? service.serviceId.name
          : '';
        const baseCost = service.serviceId && typeof service.serviceId === 'object'
          ? (service.serviceId.baseCost || 0)
          : 0;

        return {
          serviceId,
          serviceName,
          baseCost,
          addOns: service.addOns || [],
        };
      })
    : [];

  // Format requested addons
  const formattedRequestedAddons = doc.requestedAddons && Array.isArray(doc.requestedAddons)
    ? doc.requestedAddons.map((request: any) => ({
        serviceId: request.serviceId?.toString() || '',
        addonName: request.addonName || '',
        addFee: request.addFee || 0,
        addHours: request.addHours || 0,
        status: request.status || 'pending',
        requestedAt: request.requestedAt ? new Date(request.requestedAt).toISOString() : null,
        processedAt: request.processedAt ? new Date(request.processedAt).toISOString() : null,
        processedBy: request.processedBy?.toString() || null,
      }))
    : [];

  // Format agreements array
  const formattedAgreements = doc.agreements && Array.isArray(doc.agreements)
    ? doc.agreements.map((agreementEntry: any) => {
        if (typeof agreementEntry === 'object' && agreementEntry !== null) {
          // Handle new structure with agreementId and isSigned
          const agreement = agreementEntry.agreementId;
          const isSigned = agreementEntry.isSigned ?? false;
          
          if (agreement && typeof agreement === 'object' && '_id' in agreement) {
            // Agreement is populated
            return {
              _id: agreement._id?.toString() || '',
              name: agreement.name || '',
              content: agreement.content || '',
              isSigned: isSigned,
            };
          } else if (agreement && mongoose.Types.ObjectId.isValid(agreement)) {
            // Agreement is just an ObjectId (not populated)
            return {
              _id: agreement.toString(),
              name: '',
              content: '',
              isSigned: isSigned,
            };
          }
        }
        // Fallback for old structure (just ObjectId) or invalid data
        if (mongoose.Types.ObjectId.isValid(agreementEntry)) {
          return {
            _id: agreementEntry.toString(),
            name: '',
            content: '',
            isSigned: false,
          };
        }
        return {
          _id: '',
          name: '',
          content: '',
          isSigned: false,
        };
      })
    : [];

  return {
    _id: doc._id?.toString(),
    id: doc._id?.toString(),
    status: doc.status ?? "Pending",
    date: doc.date ? new Date(doc.date).toISOString() : null,
    companyId: doc.companyId ? doc.companyId.toString() : null,
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    inspector: formattedInspector,
    inspectorId: inspectorDoc ? (typeof inspectorDoc === 'object' && '_id' in inspectorDoc ? inspectorDoc._id?.toString() : (inspectorDoc as mongoose.Types.ObjectId).toString()) : null,
    companyOwnerRequested: doc.companyOwnerRequested ?? false,
    services: formattedServices,
    requestedAddons: formattedRequestedAddons,
    discountCode: formattedDiscountCode,
    discountCodeId: discountCodeDoc ? (typeof discountCodeDoc === 'object' && '_id' in discountCodeDoc ? discountCodeDoc._id?.toString() : (discountCodeDoc as mongoose.Types.ObjectId).toString()) : null,
    location: doc.location ?? null,
    headerImage: doc.headerImage ?? null,
    headerText: doc.headerText ?? null,
    headerName: doc.headerName ?? null,
    headerAddress: doc.headerAddress ?? null,
    pdfReportUrl: doc.pdfReportUrl ?? null,
    htmlReportUrl: doc.htmlReportUrl ?? null,
    pdfReportGeneratedAt: doc.pdfReportGeneratedAt ? new Date(doc.pdfReportGeneratedAt).toISOString() : null,
    htmlReportGeneratedAt: doc.htmlReportGeneratedAt ? new Date(doc.htmlReportGeneratedAt).toISOString() : null,
    hidePricing: doc.hidePricing ?? false,
    requirePaymentToReleaseReports: doc.requirePaymentToReleaseReports ?? true,
    paymentNotes: doc.paymentNotes ?? null,
    orderId: doc.orderId ?? null,
    referralSource: doc.referralSource ?? null,
    confirmedInspection: doc.confirmedInspection ?? true,
    disableAutomatedNotifications: doc.disableAutomatedNotifications ?? false,
    internalNotes: doc.internalNotes ?? null,
    clientNote: doc.clientNote ?? null,
    token: doc.token ?? null,
    clients: formattedClients,
    agents: formattedAgents,
    listingAgent: formattedListingAgents,
    agreements: formattedAgreements,
    customData: doc.customData ?? {},
    closingDate: doc.closingDate ? {
      date: doc.closingDate.date ? new Date(doc.closingDate.date).toISOString() : null,
      lastModifiedBy: doc.closingDate.lastModifiedBy && typeof doc.closingDate.lastModifiedBy === 'object'
        ? {
            _id: (doc.closingDate.lastModifiedBy as any)._id?.toString() || '',
            firstName: (doc.closingDate.lastModifiedBy as any).firstName || '',
            lastName: (doc.closingDate.lastModifiedBy as any).lastName || '',
          }
        : null,
      lastModifiedAt: doc.closingDate.lastModifiedAt ? new Date(doc.closingDate.lastModifiedAt).toISOString() : null,
    } : null,
    endOfInspectionPeriod: doc.endOfInspectionPeriod ? {
      date: doc.endOfInspectionPeriod.date ? new Date(doc.endOfInspectionPeriod.date).toISOString() : null,
      lastModifiedBy: doc.endOfInspectionPeriod.lastModifiedBy && typeof doc.endOfInspectionPeriod.lastModifiedBy === 'object'
        ? {
            _id: (doc.endOfInspectionPeriod.lastModifiedBy as any)._id?.toString() || '',
            firstName: (doc.endOfInspectionPeriod.lastModifiedBy as any).firstName || '',
            lastName: (doc.endOfInspectionPeriod.lastModifiedBy as any).lastName || '',
          }
        : null,
      lastModifiedAt: doc.endOfInspectionPeriod.lastModifiedAt ? new Date(doc.endOfInspectionPeriod.lastModifiedAt).toISOString() : null,
    } : null,
    officeNotes: formattedOfficeNotes,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
};

// 1. Create inspection scoped to a company
export async function createInspection({
  companyId,
  status,
  date,
  createdBy,
  inspector,
  companyOwnerRequested,
  services,
  discountCode,
  location,
  requirePaymentToReleaseReports,
  paymentNotes,
  orderId,
  referralSource,
  confirmedInspection,
  disableAutomatedNotifications,
  internalNotes,
  clientNote,
  clientAgreedToTerms,
  token,
  customData,
}: CreateInspectionParams) {
  if (!companyId) {
    throw new Error("Missing required inspection fields");
  }

  await dbConnect();

  const inspectionData: any = {
    status: status ?? "Pending",
    date: date ? new Date(date) : new Date(),
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
    inspectionData.createdBy = new mongoose.Types.ObjectId(createdBy);
  }

  if (inspector && mongoose.Types.ObjectId.isValid(inspector)) {
    inspectionData.inspector = new mongoose.Types.ObjectId(inspector);
  }

  if (companyOwnerRequested !== undefined) {
    inspectionData.companyOwnerRequested = companyOwnerRequested;
  }

  if (services && Array.isArray(services)) {
    inspectionData.services = services.map(service => ({
      serviceId: new mongoose.Types.ObjectId(service.serviceId),
      addOns: service.addOns || [],
    }));
  }

  if (discountCode && mongoose.Types.ObjectId.isValid(discountCode)) {
    inspectionData.discountCode = new mongoose.Types.ObjectId(discountCode);
  }

  if (location) {
    inspectionData.location = {};
    if (location.address) inspectionData.location.address = String(location.address).trim();
    if (location.unit) inspectionData.location.unit = String(location.unit).trim();
    if (location.city) inspectionData.location.city = String(location.city).trim();
    if (location.state) inspectionData.location.state = String(location.state).trim();
    if (location.zip) inspectionData.location.zip = String(location.zip).trim();
    if (location.county) inspectionData.location.county = String(location.county).trim();
    if (location.squareFeet !== undefined) inspectionData.location.squareFeet = Number(location.squareFeet);
    if (location.yearBuild !== undefined) inspectionData.location.yearBuild = Number(location.yearBuild);
    if (location.foundation) inspectionData.location.foundation = location.foundation;
  }

  if (requirePaymentToReleaseReports !== undefined) {
    inspectionData.requirePaymentToReleaseReports = requirePaymentToReleaseReports;
  }

  if (paymentNotes !== undefined && paymentNotes.trim()) {
    inspectionData.paymentNotes = String(paymentNotes).trim();
  }

  if (orderId !== undefined) {
    inspectionData.orderId = orderId;
  }

  if (referralSource !== undefined && referralSource.trim()) {
    inspectionData.referralSource = String(referralSource).trim();
  }

  if (confirmedInspection !== undefined) {
    inspectionData.confirmedInspection = confirmedInspection;
  }

  if (disableAutomatedNotifications !== undefined) {
    inspectionData.disableAutomatedNotifications = disableAutomatedNotifications;
  }

  if (internalNotes !== undefined && internalNotes.trim()) {
    inspectionData.internalNotes = String(internalNotes).trim();
  }

  if (clientNote !== undefined && clientNote.trim()) {
    inspectionData.clientNote = String(clientNote).trim();
  }

  if (clientAgreedToTerms !== undefined) {
    inspectionData.clientAgreedToTerms = clientAgreedToTerms;
  }

  if (token !== undefined && token.trim()) {
    inspectionData.token = String(token).trim();
  }

  if (customData !== undefined && Object.keys(customData).length > 0) {
    inspectionData.customData = customData;
  }

  const inspection = await Inspection.create(inspectionData);
  return formatInspection(inspection);
}

// 2. Get all inspections for a company with filters and search
export async function getAllInspections(
  companyId: string,
  options?: {
    filter?: 'all' | 'today' | 'tomorrow' | 'pending' | 'in-progress' | 'trash';
    search?: string;
  }
) {
  if (!companyId) {
    return [];
  }

  await dbConnect();

  const filter = options?.filter || 'all';
  const search = options?.search?.trim() || '';

  // Build base query
  const queryConditions: any[] = [
    { companyId: new mongoose.Types.ObjectId(companyId) }
  ];

  // Handle soft delete filter
  if (filter === 'trash') {
    queryConditions.push({ deletedAt: { $ne: null, $exists: true } });
  } else {
    // Exclude soft-deleted inspections by default
    queryConditions.push({
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    });
  }

  // Handle date filters
  if (filter === 'today' || filter === 'tomorrow') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (filter === 'today') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      queryConditions.push({
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });
    } else if (filter === 'tomorrow') {
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      queryConditions.push({
        date: {
          $gte: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          $lt: dayAfterTomorrow
        }
      });
    }
  }

  // Handle status filters
  if (filter === 'pending') {
    queryConditions.push({ status: 'Pending' });
  } else if (filter === 'in-progress') {
    queryConditions.push({ status: 'In-Progress' });
  }

  // Combine all conditions with $and
  const query = queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];

  // Execute base query
  let inspections = await Inspection.find(query)
    .populate('agents', 'firstName lastName')
    .populate('clients', 'firstName lastName companyName isCompany')
    .populate('listingAgent', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .lean();

  // Apply search filter if provided
  if (search) {
    const searchLower = search.toLowerCase();
    const searchRegex = new RegExp(searchLower, 'i');

    // Get client emails that match the search
    const matchingClients = await Client.find({
      company: new mongoose.Types.ObjectId(companyId),
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex }
      ]
    }).select('email').lean();

    const clientEmails = new Set(matchingClients.map((c: any) => c.email?.toLowerCase()));

    // Get agent IDs that match the search
    const matchingAgents = await Agent.find({
      company: new mongoose.Types.ObjectId(companyId),
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ]
    }).select('_id').lean();

    const agentIds = new Set(matchingAgents.map((a: any) => a._id.toString()));

    // Filter inspections by search criteria
    inspections = inspections.filter((inspection: any) => {
      // Search in location fields
      if (inspection.location) {
        if (
          (inspection.location.address && searchRegex.test(inspection.location.address)) ||
          (inspection.location.city && searchRegex.test(inspection.location.city)) ||
          (inspection.location.state && searchRegex.test(inspection.location.state)) ||
          (inspection.location.zip && searchRegex.test(inspection.location.zip))
        ) {
          return true;
        }
      }

      // Search in agent names (populated)
      if (inspection.agents && Array.isArray(inspection.agents)) {
        for (const agent of inspection.agents) {
          if (agent && typeof agent === 'object') {
            const agentId = agent._id?.toString() || agent.toString();
            if (agentIds.has(agentId)) {
              return true;
            }
            const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.toLowerCase();
            if (fullName.includes(searchLower)) {
              return true;
            }
          } else if (agentIds.has(agent.toString())) {
            return true;
          }
        }
      }

      // Note: Client search by email matching would require storing client emails in inspection
      // For now, we skip client search as there's no direct relationship

      return false;
    });
  }

  return inspections.map((inspection) => formatInspection(inspection as any)).filter(Boolean);
}

// 3. Get single inspection by ID
export async function getInspection(inspectionId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw new Error('Invalid inspection ID format');
  }

  await dbConnect();

  const inspection = await Inspection.findById(inspectionId)
    .populate('inspector', 'firstName lastName email phoneNumber profileImageUrl')
    .populate('clients', 'firstName lastName companyName email phone isCompany')
    .populate('agreements.agreementId', 'name content')
    .populate('agents', 'firstName lastName email phone photoUrl')
    .populate('listingAgent', 'firstName lastName email phone photoUrl')
    .populate('discountCode', 'code type value active')
    .populate('officeNotes.createdBy', 'firstName lastName profileImageUrl')
    .populate('closingDate.lastModifiedBy', 'firstName lastName')
    .populate('endOfInspectionPeriod.lastModifiedBy', 'firstName lastName')
    .populate('services.serviceId', 'name baseCost')
    .lean();
  return formatInspection(inspection as any);
}

// 4. Soft delete inspection
export async function deleteInspection(inspectionId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw new Error('Invalid inspection ID format');
  }

  await dbConnect();

  const result = await Inspection.updateOne(
    {
      _id: new mongoose.Types.ObjectId(inspectionId)
    },
    {
      $set: { deletedAt: new Date() }
    }
  );

  return {
    deletedCount: result.modifiedCount,
    acknowledged: result.acknowledged,
  };
}

// 5. Update inspection - can update any inspection field including headerImage and headerText
export async function updateInspection(inspectionId: string, data: Partial<{
  status: string;
  date: string | Date;
  headerImage: string;
  headerText: string; // legacy single-line header
  headerName: string; // new: name line
  headerAddress: string; // new: address line
  pdfReportUrl: string; // permanent PDF report URL
  htmlReportUrl: string; // permanent HTML report URL
  pdfReportGeneratedAt: Date; // timestamp when PDF was generated
  htmlReportGeneratedAt: Date; // timestamp when HTML was generated
  hidePricing: boolean; // hide cost estimates in all report formats
  inspector: string; // inspector ID
  clients: string[]; // array of client IDs
  agents: string[]; // array of agent IDs
  listingAgent: string[]; // array of listing agent IDs
  referralSource: string; // referral source
  discountCode: string; // discount code ID
  services: Array<{
    serviceId: string;
    addOns?: Array<{
      name: string;
      addFee?: number;
      addHours?: number;
    }>;
  }>; // services with their addons
  customData: Record<string, any>; // custom field data
  internalNotes: string; // internal notes
  closingDate: { date?: string | Date; lastModifiedBy?: string; lastModifiedAt?: Date }; // closing date with metadata
  endOfInspectionPeriod: { date?: string | Date; lastModifiedBy?: string; lastModifiedAt?: Date }; // end of inspection period with metadata
}>) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw new Error('Invalid inspection ID format');
  }

  await dbConnect();

  // Filter out undefined values to only update fields that are provided
  const updateData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      // Convert IDs to ObjectId for reference fields
      if (key === 'inspector' && value && mongoose.Types.ObjectId.isValid(value as string)) {
        acc[key] = new mongoose.Types.ObjectId(value as string);
      } else if (key === 'discountCode' && value && mongoose.Types.ObjectId.isValid(value as string)) {
        acc[key] = new mongoose.Types.ObjectId(value as string);
      } else if ((key === 'clients' || key === 'agents' || key === 'listingAgent') && Array.isArray(value)) {
        // @ts-ignore
        acc[key] = value.map((id: string) => 
          mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
        );
      } else if (key === 'services' && Array.isArray(value)) {
        // Handle services array with serviceId conversion to ObjectId
        acc[key] = value.map((service: any) => ({
          serviceId: mongoose.Types.ObjectId.isValid(service.serviceId) 
            ? new mongoose.Types.ObjectId(service.serviceId) 
            : service.serviceId,
          addOns: service.addOns || [],
        }));
      } else if (key === 'closingDate' || key === 'endOfInspectionPeriod') {
        // Handle date fields with metadata
        const dateField = value as { date?: string | Date; lastModifiedBy?: string; lastModifiedAt?: Date };
        const processedField: any = {};
        if (dateField.date !== undefined) {
          processedField.date = dateField.date ? new Date(dateField.date) : null;
        }
        if (dateField.lastModifiedBy && mongoose.Types.ObjectId.isValid(dateField.lastModifiedBy)) {
          processedField.lastModifiedBy = new mongoose.Types.ObjectId(dateField.lastModifiedBy);
        }
        if (dateField.lastModifiedAt !== undefined) {
          processedField.lastModifiedAt = dateField.lastModifiedAt ? new Date(dateField.lastModifiedAt) : new Date();
        }
        acc[key] = processedField;
      } else {
        acc[key] = value;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  if (Object.keys(updateData).length === 0) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  const result = await Inspection.updateOne(
    { _id: new mongoose.Types.ObjectId(inspectionId) },
    { $set: updateData }
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    acknowledged: result.acknowledged,
  };
}