export default {
	// Templates
	templates: {
		create: '/templates',
		get: '/templates',
		update: '/templates/:id',
		delete: '/templates/:id',
		reorder: '/templates/reorder',
		deleted: '/templates/deleted',
		restore: '/templates/:id/restore',
	},
	// Template Sections
	templateSections: {
		get: (templateId: string) => `/templates/${templateId}/sections`,
		create: (templateId: string) => `/templates/${templateId}/sections`,
		update: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}`,
		delete: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}`,
		reorder: (templateId: string) => `/templates/${templateId}/sections/reorder`,
		deleted: (templateId: string) => `/templates/${templateId}/sections/deleted`,
		restore: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/restore`,
	},
	// Template Subsections
	templateSubsections: {
		get: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections`,
		create: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections`,
		update: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}`,
		delete: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}`,
		reorder: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/reorder`,
		deleted: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/deleted`,
		restore: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/restore`,
	},
	// Template Checklists
	templateChecklists: {
		get: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists`,
		create: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists`,
		update: (templateId: string, sectionId: string, subsectionId: string, checklistId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists/${checklistId}`,
		delete: (templateId: string, sectionId: string, subsectionId: string, checklistId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists/${checklistId}`,
		reorder: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists/reorder`,
	},
	// Reusable Dropdowns
	reusableDropdowns: {
		get: '/reusable-dropdowns',
		update: '/reusable-dropdowns',
	},
	// Services
	services: {
		get: '/services',
		create: '/services',
		getById: (serviceId: string) => `/services/${serviceId}`,
		update: (serviceId: string) => `/services/${serviceId}`,
		delete: (serviceId: string) => `/services/${serviceId}`,
		reorder: '/services/reorder',
		duplicate: (serviceId: string) => `/services/${serviceId}/duplicate`,
	},
	// Modifiers
	modifiers: {
		get: '/modifiers',
	},
	// Agreements
	agreements: {
		get: '/agreements',
	},
}