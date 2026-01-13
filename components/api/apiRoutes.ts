export default {
	// Templates
	templates: {
		create: '/templates',
		get: '/templates',
		update: '/templates/:id',
		delete: '/templates/:id',
		reorder: '/templates/reorder',
	},
	// Template Sections
	templateSections: {
		get: (templateId: string) => `/templates/${templateId}/sections`,
		create: (templateId: string) => `/templates/${templateId}/sections`,
		update: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}`,
		delete: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}`,
		reorder: (templateId: string) => `/templates/${templateId}/sections/reorder`,
	},
	// Template Subsections
	templateSubsections: {
		get: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections`,
		create: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections`,
		update: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}`,
		delete: (templateId: string, sectionId: string, subsectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/${subsectionId}`,
		reorder: (templateId: string, sectionId: string) => `/templates/${templateId}/sections/${sectionId}/subsections/reorder`,
	},
}