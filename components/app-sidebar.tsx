"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	FileText,
	ImageIcon,
	ClipboardList,
	Settings,
	Users,
	FolderOpen,
	Camera,
	Shield,
	UserCog,
	Wrench,
	CalendarClock,
	BookMarked,
	SlidersHorizontal,
	BadgePercent,
	FileSignature,
	Share2,
	CalendarCheck,
	Contact,
	ListChecks,
	Zap,
} from "lucide-react";

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";

// Navigation data for ReportWriter AI Inspection App
const data = {
	navMain: [
		{
			title: "Main",
			items: [
				{
					title: "Dashboard",
					url: "/",
					icon: LayoutDashboard,
				},
				{
					title: "Inspections",
					url: "/inspections",
					icon: ClipboardList,
				},
				{
					title: "Templates",
					url: "/templates",
					icon: FileText,
				},
				// {
				// 	title: "Reports",
				// 	url: "/reports",
				// 	icon: FileText,
				// },
				{
					title: "Sample Reports",
					url: "/sample-report",
					icon: BookMarked,
				},
				{
					title: "Services",
					url: "/services",
					icon: Wrench,
				},
				{
					title: "Discount Codes",
					url: "/discount-codes",
					icon: BadgePercent,
				},
				{
					title: "Agreements",
					url: "/agreements",
					icon: FileSignature,
				},
				{
					title: "Contacts",
					url: "/contacts",
					icon: Contact,
				},
				{
					title: "Modifiers",
					url: "/modifiers",
					icon: SlidersHorizontal,
				},
				{
					title: "Availability",
					url: "/availability",
					icon: CalendarClock,
				},
				{
					title: "Automations",
					url: "/automations",
					icon: Zap,
				},
			],
		},
		{
			title: "Tools",
			items: [
				{
					title: "Photo Capture",
					url: "/photo-capture",
					icon: Camera,
				},
				{
					title: "File Manager",
					url: "/files",
					icon: FolderOpen,
				},
			],
		},
			{
				title: "Settings",
				items: [
					{
						title: "Team",
						url: "/team",
						icon: UserCog,
					},
					{
						title: "Company",
						url: "/company",
						icon: Users,
					},
					{
						title: "Social Links",
						url: "/social-links",
						icon: Share2,
					},
					{
						title: "Online Scheduler",
						url: "/online-scheduler",
						icon: CalendarCheck,
					},
					{
						title: "Scheduling Options",
						url: "/scheduling-options",
						icon: Settings,
					},
					// {
					// 	title: "Sections",
					// 	url: "/sections",
					// 	icon: ListChecks,
					// },
					{
						title: "Drop-Downs",
						url: "/drop-downs",
						icon: ListChecks,
					},
				],
			},
	],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const { setOpenMobile, isMobile } = useSidebar();

	const handleLinkClick = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<Sidebar {...props}>
			<SidebarHeader className="border-b px-6 py-4">
				<div className="flex items-center gap-2">
					<Shield className="h-6 w-6 text-primary" />
					<div>
						<h2 className="text-lg font-semibold">ReportWriter AI</h2>
						<p className="text-xs text-muted-foreground">Inspection Reports</p>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				{/* We create a SidebarGroup for each section */}
				{data.navMain.map((section) => (
					<SidebarGroup key={section.title}>
						<SidebarGroupLabel>{section.title}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{section.items.map((item) => {
									const Icon = item.icon;
									const isActive = pathname === item.url || (item.url !== "/company" && pathname?.startsWith(item.url));
									
									return (
										<SidebarMenuItem key={item.title}>
											<SidebarMenuButton asChild isActive={isActive}>
												<Link href={item.url} onClick={handleLinkClick}>
													<Icon className="h-4 w-4" />
													<span>{item.title}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
