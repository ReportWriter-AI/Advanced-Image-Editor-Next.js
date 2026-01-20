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
	// Inspection Templates
	inspectionTemplates: {
		get: (inspectionId: string) => `/inspections/${inspectionId}/templates`,
		getById: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}`,
		update: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}`,
		delete: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}`,
		validatePublish: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/validate-publish`,
		completionStatus: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/completion-status`,
		searchChecklists: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/search-checklists`,
	},
	// Inspection Template Sections
	inspectionTemplateSections: {
		get: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections`,
		create: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections`,
		update: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}`,
		delete: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}`,
		reorder: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/reorder`,
		deleted: (inspectionId: string, templateId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/deleted`,
		restore: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/restore`,
	},
	// Inspection Template Subsections
	inspectionTemplateSubsections: {
		get: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections`,
		create: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections`,
		update: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}`,
		delete: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}`,
		reorder: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/reorder`,
		deleted: (inspectionId: string, templateId: string, sectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/deleted`,
		restore: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/restore`,
	},
	// Inspection Template Checklists
	inspectionTemplateChecklists: {
		get: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists`,
		create: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists`,
		update: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string, checklistId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists/${checklistId}`,
		delete: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string, checklistId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists/${checklistId}`,
		reorder: (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => `/inspections/${inspectionId}/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}/checklists/reorder`,
	},
	// Defects
	defects: {
		bySubsection: (params: { inspectionId: string; templateId: string; sectionId: string; subsectionId: string }) => 
			`/defects/by-subsection?inspectionId=${params.inspectionId}&templateId=${params.templateId}&sectionId=${params.sectionId}&subsectionId=${params.subsectionId}`,
		update: (defectId: string) => `/defects/${defectId}`,
		delete: (defectId: string) => `/defects/${defectId}`,
	},
	// Inspections
	inspections: {
		get: (inspectionId: string) => `/inspections/${inspectionId}`,
		update: (inspectionId: string) => `/inspections/${inspectionId}`,
		publish: (inspectionId: string) => `/inspections/${inspectionId}/publish`,
	},
}