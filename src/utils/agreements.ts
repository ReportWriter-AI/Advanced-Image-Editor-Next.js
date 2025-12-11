const PLACEHOLDER_SECTIONS = [
	{
		title: "Inspection Property Details",
		placeholders: [
			{ token: "[ADDRESS]", description: "Full inspection address including city, state, and zip." }, //you
			// { token: "[STREET]", description: "Street portion of the inspection address." },
			// { token: "[CITY]", description: "City where the inspection takes place." },
			// { token: "[STATE]", description: "State for the inspection location." },
			// { token: "[ZIP]", description: "Zip code for the inspection address." },
			{ token: "[COUNTY]", description: "County of the inspection (blank if not recorded)." }, //you
			// { token: "[YEAR_BUILT]", description: "Home build year from inspection details." },
			// { token: "[FOUNDATION]", description: "Foundation type selected during scheduling." },
			// { token: "[SQUARE_FEET]", description: "Total square footage entered for the inspection." },
		],
	},
	{
		title: "Fees and Services",
		placeholders: [
			// { token: "[DESCRIPTION]", description: "Display names of the templates/services associated." },
			// { token: "[NOTES]", description: "Internal inspection notes." },
			{ token: "[PRICE]", description: "Total cost of the inspection." }, //you
			{ token: "[FEES]", description: "Services and their costs separated by commas." }, //you
			{ token: "[SERVICES]", description: "Comma-separated list of services." }, //you
			// { token: "[EVENTS]", description: "Table of events with times and inspector names." },
			// { token: "[EVENTS_LIST]", description: "Table showing event start and end times." },
			// { token: "[EVENTS_TEXT]", description: "Text list of events with times and inspector names." },
			// { token: "[EVENTS_LIST_TEXT]", description: "Text list of events with start/end times only." },
			// { token: "[PAID]", description: "Yes/No if the inspection is paid." },
			// { token: "[PUBLISHED]", description: "Yes/No if reports are published." },
			// { token: "[AGREED]", description: "Yes/No if all agreements are signed." },
			// { token: "[ORDER_ID]", description: "Order identifier for the inspection." },
			{ token: "[CURRENT_DATE]", description: "Current date (ex: schedule date)." }, //you
			{ token: "[CURRENT_YEAR]", description: "Current calendar year." }, //you
		],
	},
	{
		title: "Client Information",
		placeholders: [
			{ token: "[CLIENT_NAME]", description: "Client’s full name." }, //you
			// { token: "[CLIENT_FIRST_NAME]", description: "Client’s first name." },
			{ token: "[CUSTOMER_INITIALS]", description: "Blank space to capture initials." }, //you
			{ token: "[REQUIRED_CUSTOMER_INITIALS]", description: "Required customer initials." }, //you
			// { token: "[CLIENT_CONTACT_INFO]", description: "Client email plus phone number." },
			// { token: "[CLIENT_PHONE]", description: "Client phone number." },
			// { token: "[CLIENT_EMAIL]", description: "Client email address." },
			// { token: "[CLIENT_ADDRESS]", description: "Client mailing address (requires buyer address capture setting)." },
		],
	},
	// {
	//   title: "Client's Agent Information",
	//   placeholders: [
	//     { token: "[AGENT_NAME]", description: "Client agent’s full name." },
	//     { token: "[AGENT_FIRST_NAME]", description: "Client agent’s first name." },
	//     { token: "[AGENT_CONTACT_INFO]", description: "Client agent’s email plus phone." },
	//     { token: "[AGENT_PHONE]", description: "Client agent’s phone number." },
	//     { token: "[AGENT_EMAIL]", description: "Client agent’s email address." },
	//     { token: "[AGENT_ADDRESS]", description: "Client agent’s street address." },
	//     { token: "[AGENT_FULL_ADDRESS]", description: "Client agent’s full address (street, city, state, zip)." },
	//     { token: "[AGENT_CITY]", description: "Client agent’s city." },
	//     { token: "[AGENT_STATE]", description: "Client agent’s state." },
	//     { token: "[AGENT_ZIP]", description: "Client agent’s zip code." },
	//   ],
	// },
	// {
	//   title: "Listing Agent Information",
	//   placeholders: [
	//     { token: "[SELLING_AGENT_NAME]", description: "Listing agent’s full name." },
	//     { token: "[SELLING_AGENT_FIRST_NAME]", description: "Listing agent’s first name." },
	//     { token: "[SELLING_AGENT_CONTACT_INFO]", description: "Listing agent’s email plus phone." },
	//     { token: "[LISTING_AGENT_PHONE]", description: "Listing agent’s phone number." },
	//     { token: "[LISTING_AGENT_EMAIL]", description: "Listing agent’s email address." },
	//     { token: "[SELLING_AGENT_ADDRESS]", description: "Listing agent’s street address." },
	//     { token: "[SELLING_AGENT_FULL_ADDRESS]", description: "Listing agent’s full address (street, city, state, zip)." },
	//     { token: "[SELLING_AGENT_CITY]", description: "Listing agent’s city." },
	//     { token: "[SELLING_AGENT_STATE]", description: "Listing agent’s state." },
	//     { token: "[SELLING_AGENT_ZIP]", description: "Listing agent’s zip code." },
	//   ],
	// },
	{
		title: "Inspection Details",
		placeholders: [
			{ token: "[INSPECTION_DATE]", description: "Scheduled inspection date." }, //you
			{ token: "[INSPECTION_TIME]", description: "Inspection start time." }, //you
			// { token: "[INSPECTION_END_TIME]", description: "Scheduled inspection end time." },
			// { token: "[SECURE_24_OPT_OUT]", description: "Yes/No if Secure24 opt-in was declined." },
			// { token: "[EDIT_LINK]", description: "Internal link to the report editor." },
			// { token: "[SIGN_AND_PAY_LINK]", description: "Button leading to sign-and-pay portal." },
			// { token: "[SIGN_LINK]", description: "Button linking to the client portal signature page." },
			// { token: "[PAY_LINK]", description: "Button linking to the payment page." },
			// { token: "[INSPECTION_TEXT_LINK]", description: "Mobile-friendly inspection details link." },
			// { token: "[INVOICE_LINK]", description: "Button linking to the invoice." },
			// { token: "[INVOICE_TEXT_LINK]", description: "Mobile-friendly invoice link." },
			// { token: "[VIEW_REPORT_ON_CLIENT_PORTAL_LINK]", description: "Button linking to the client portal report view." },
			// { token: "[REPORT_TEXT_LINK]", description: "Mobile-friendly link to all web reports." },
			// { token: "[REPORT_LINK]", description: "Link to all web reports." },
			// { token: "[REPORT_PDF]", description: "Buttons for every report PDF and attachment." },
			// { token: "[SUMMARY_PDF]", description: "Button for the PDF summary only." },
			// { token: "[REVIEW_LINK]", description: "Link encouraging review submissions." },
			// { token: "[REVIEW_STARS]", description: "Star graphic for reviews." },
			// { token: "[REPORT_PUBLISHED_LINK]", description: "Link to published reports only." },
			// { token: "[REPORT_PUBLISHED_TEXT_LINK]", description: "Mobile-friendly link to published reports only." },
		],
	},
	{
		title: "Inspector Information",
		placeholders: [
			// { token: "[INSPECTOR_FIRST_NAME]", description: "Primary inspector’s first name." },
			// { token: "[INSPECTOR_NAME]", description: "Primary inspector’s full name." },
			// { token: "[INSPECTORS]", description: "Full names of all assigned inspectors." },
			// { token: "[INSPECTORS_FIRST_NAMES]", description: "First names of all assigned inspectors." },
			// { token: "[INSPECTOR_PHONE]", description: "Primary inspector’s phone number." },
			// { token: "[INSPECTOR_EMAIL]", description: "Primary inspector’s email address." },
			// { token: "[INSPECTOR_CREDENTIALS]", description: "Licensing credentials from inspector profile." },
			// { token: "[INSPECTOR_IMAGE]", description: "Inspector profile photo." },
			{ token: "[INSPECTOR_SIGNATURE]", description: "Inspector signature image asset." }, //you
			// { token: "[INSPECTOR_DESCRIPTION]", description: "Inspector bio/description." },
			// { token: "[INSPECTOR_NOTES]", description: "Notes stored on the inspector profile." },
			// { token: "[INSPECTOR_INITIALS]", description: "Primary inspector’s initials." },
		],
	},
	{
		title: "Company Information",
		placeholders: [
			{ token: "[INSPECTION_COMPANY]", description: "Company name from profile settings." },
			{ token: "[INSPECTION_COMPANY_PHONE]", description: "Company phone number from profile." },
			{ token: "[COMPANY_ADDRESS]", description: "Company street address." },
			{ token: "[COMPANY_CITY]", description: "Company city." },
			{ token: "[COMPANY_STATE]", description: "Company state." },
			{ token: "[COMPANY_ZIP]", description: "Company zip code." },
			{ token: "[COMPANY_PHONE]", description: "Alternate company phone contact." },
			{ token: "[COMPANY_WEBSITE]", description: "Company website URL." }, //you
		],
	},
];