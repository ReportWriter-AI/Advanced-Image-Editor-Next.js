"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import InspectionsTable from '../../components/InspectionsTable';
import DefectEditModal from '../../components/DefectEditModal';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [defectModalOpen, setDefectModalOpen] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>('');
  const [selectedInspectionName, setSelectedInspectionName] = useState<string>('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

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
  const handleDeleteClick = async (inspectionId: string) => {
    if (!confirm('Are you sure you want to delete this inspection?')) {
          return;
        }
      
    try {
      console.log('inspection_id', inspectionId);
      // setDeletingId(inspectionId);
      
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete inspection');
      }

      console.log('Success:', data.message);
      // Refresh the inspections list or update state
      // alert('Inspection deleted successfully!');
      window.location.href = '/';
      
    } catch (error: any) {
      console.error('Error deleting inspection:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // setDeletingId(null);
    }
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
    </>
  );
}
