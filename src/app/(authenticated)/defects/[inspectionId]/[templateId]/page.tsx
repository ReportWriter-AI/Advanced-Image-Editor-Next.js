"use client";

import { useSearchParams } from 'next/navigation';
import DefectsList from '@/components/DefectsList';

export default function DefectsPage() {
	const searchParams = useSearchParams();
	
	const sectionId = searchParams.get('sectionId') || undefined;
	const subsectionId = searchParams.get('subsectionId') || undefined;

	return (
		<DefectsList
			sectionId={sectionId}
			subsectionId={subsectionId}
		/>
	);
}
