"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InspectionsTable from '../../../../components/InspectionsTable';
import DefectEditModal from '../../../../components/DefectEditModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Home() {
  const router = useRouter();
  const [defectModalOpen, setDefectModalOpen] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>('');
  const [selectedInspectionName, setSelectedInspectionName] = useState<string>('');
  const [inspectionPendingDelete, setInspectionPendingDelete] = useState<string | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Handle row click to open ImageEditor
  const handleRowClick = (inspectionId: string) => {
    router.push(`/image-editor?inspectionId=${inspectionId}`);
  };

  // Handle document click to view inspection report
  const handleDocumentClick = (inspectionId: string) => {
    router.push(`/inspection_report/${inspectionId}`);
  };

  // Handle edit click to edit inspection defects
  const handleEditClick = (inspectionId: string) => {
    setSelectedInspectionId(inspectionId);
    setSelectedInspectionName(`Inspection ${inspectionId.slice(-4)}`);
    setDefectModalOpen(true);
  };

  // Handle close defect modal
  const handleCloseDefectModal = () => {
    setDefectModalOpen(false);
    setSelectedInspectionId('');
    setSelectedInspectionName('');
  };

  // Check for pending annotations when page loads or receives focus
  useEffect(() => {
    const checkPendingAnnotation = () => {
      const pending = localStorage.getItem('pendingAnnotation');
      if (pending) {
        try {
          const annotation = JSON.parse(pending);
          console.log('🔍 Main page detected pending annotation:', annotation);

          // If we have an inspectionId, auto-open the modal
          if (annotation.inspectionId) {
            console.log('🚀 Auto-opening modal for inspection:', annotation.inspectionId);
            setSelectedInspectionId(annotation.inspectionId);
            setSelectedInspectionName(`Inspection ${annotation.inspectionId.slice(-4)}`);
            setDefectModalOpen(true);
            // Note: Don't clear localStorage here - let InformationSections handle it
          }
        } catch (e) {
          console.error('Error parsing pending annotation:', e);
        }
      }
    };

    // Check immediately on mount
    checkPendingAnnotation();

    // Also check when window regains focus
    const handleFocus = () => {
      checkPendingAnnotation();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Handle delete click to delete inspection
  const handleDeleteClick = (inspectionId: string) => {
    setDeleteError(null);
    setInspectionPendingDelete(inspectionId);
  };

  const confirmDeleteInspection = async () => {
    if (!inspectionPendingDelete) return;

    try {
      setDeleteInFlight(true);
      setDeleteError(null);

      const response = await fetch(`/api/inspections/${inspectionPendingDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete inspection');
      }

      window.location.reload();
    } catch (error: any) {
      console.error('Error deleting inspection:', error);
      setDeleteError(error.message || 'Failed to delete inspection');
    } finally {
      setDeleteInFlight(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteInFlight) return;
    setInspectionPendingDelete(null);
    setDeleteError(null);
  };

  // Show table page
  return (
    <>
      <InspectionsTable
        onRowClick={handleRowClick}
        onDocumentClick={handleDocumentClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <DefectEditModal
        isOpen={defectModalOpen}
        onClose={handleCloseDefectModal}
        inspectionId={selectedInspectionId}
        inspectionName={selectedInspectionName}
      />

      <AlertDialog open={Boolean(inspectionPendingDelete)} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The inspection and all related data will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInFlight}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteInspection}
              disabled={deleteInFlight}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInFlight ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
