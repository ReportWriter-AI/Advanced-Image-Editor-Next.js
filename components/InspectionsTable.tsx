"use client";

import { useState, useEffect } from 'react';

interface Inspection {
  id: string;
  inspectionName: string;
  date: string;
  status: string;
}

interface InspectionsTableProps {
  onRowClick: (inspectionId: string) => void;
  onDocumentClick: (inspectionId: string) => void;
  onEditClick?: (inspectionId: string) => void;
  onDeleteClick?: (inspectionId: string) => void;
}

const mapInspection = (item: any): Inspection => ({
  id:
    (item && (item.id || item._id))?.toString?.() ||
    Math.random().toString(36).slice(2, 9),
  inspectionName: item?.name || item?.inspectionName || "Unnamed Inspection",
  date: item?.date
    ? new Date(item.date).toLocaleDateString()
    : new Date().toLocaleDateString(),
  status: item?.status || "Pending",
});

export default function InspectionsTable({
  onRowClick,
  onDocumentClick,
  onEditClick,
  onDeleteClick,
}: InspectionsTableProps) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [showAddInspectionPopup, setShowAddInspectionPopup] = useState(false);
  const [newInspectionName, setNewInspectionName] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch inspections on component mount
  useEffect(() => {
    const fetchInspections = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/inspections', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // Map API data to expected interface structure
          const mappedInspections: Inspection[] = Array.isArray(data)
            ? data.map(mapInspection)
            : [];
          setInspections(mappedInspections);
        } else {
          console.error('Failed to fetch inspections');
        }
      } catch (error) {
        console.error('Error fetching inspections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInspections();
  }, []);

  const handleAddInspection = () => {
    setShowAddInspectionPopup(true);
  };

  const handleCancelInspection = () => {
    setShowAddInspectionPopup(false);
    setNewInspectionName('');
  };

  const handleSaveInspection = async () => {
    if (!newInspectionName.trim()) return;

    try {
      const response = await fetch('/api/inspections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          inspectionName: newInspectionName.trim(),
        }),
      });

      if (response.ok) {
        const createdInspection = await response.json();
        setInspections(prev => [...prev, mapInspection(createdInspection)]);
        setShowAddInspectionPopup(false);
        setNewInspectionName('');
      } else {
        console.error('Failed to create inspection');
      }
    } catch (error) {
      console.error('Error creating inspection:', error);
    }
  };

  return (
    <div className="app-container">
      {/* Header Section */}
      {/* <div className="heading-section">
        <div className="heading-content">
          <i className="fas fa-clipboard-list heading-icon"></i>
          <h1>Inspections</h1>
          <p>Manage your property inspections efficiently</p>
        </div>
      </div> */}

      {/* Action Bar with Add Inspection Button */}
      <div className="action-bar">
        <div className="action-bar-content">
          <div className="action-bar-left">
            {/* Empty space for future content */}
          </div>
          <div className="action-bar-right">
            <button className="add-btn" onClick={handleAddInspection}>
              <i className="fas fa-plus"></i>
              <span className="btn-text">Add Inspection</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-section">
        <div className="table-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading inspections...</p>
            </div>
          ) : inspections.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-clipboard-list empty-icon"></i>
              <h3>No Inspections Found</h3>
              <p>Get started by creating your first inspection.</p>
            </div>
          ) : (
            <table className="inspections-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Inspection Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((inspection) => {
                  // Safety checks to prevent runtime errors
                  const safeId = inspection?.id?.toString() || 'unknown';
                  const safeName = inspection?.inspectionName || 'Unnamed Inspection';
                  const safeDate = inspection?.date || 'Unknown Date';
                  const safeStatus = inspection?.status || 'Unknown';
                  
                  return (
                    <tr
                      key={safeId}
                      className="table-row"
                      onClick={() => onRowClick(safeId)}
                    >
                      <td className="id-cell">
                        <span className="id-badge">
                          {safeId.slice(-4)}
                        </span>
                      </td>
                      <td className="name-cell">
                        <span className="inspection-name">{safeName}</span>
                      </td>
                      <td className="date-cell">
                        <span className="date-text">{safeDate}</span>
                      </td>
                      <td className="status-cell">
                        <span
                          className={`status-badge status-${safeStatus.toLowerCase().replace(' ', '-')}`}
                        >
                          {safeStatus}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDocumentClick(safeId);
                            }}
                            className="action-btn-small document-btn"
                            title="View Document"
                          >
                            <i className="fas fa-file-alt"></i>
                          </button>
                          {onEditClick && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditClick(safeId);
                              }}
                              className="action-btn-small edit-btn"
                              title="Edit Inspection"
                            >
                              <i className="fas fa-pencil-alt"></i>
                            </button>
                          )}
                          {onDeleteClick && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(safeId);
                              }}
                              className="action-btn-small delete-btn"
                              title="Delete Inspection"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Inspection Popup */}
      {showAddInspectionPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="popup-header">
              <h3>Add New Inspection</h3>
              <button 
                className="popup-close-btn"
                onClick={handleCancelInspection}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="popup-body">
              <div className="form-group">
                <label htmlFor="inspectionName">Inspection Name</label>
                <input
                  type="text"
                  id="inspectionName"
                  value={newInspectionName}
                  onChange={(e) => setNewInspectionName(e.target.value)}
                  placeholder="Enter inspection name..."
                  className="form-input"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="popup-footer">
              <button 
                className="popup-btn cancel-btn"
                onClick={handleCancelInspection}
              >
                Cancel
              </button>
              <button 
                className="popup-btn save-btn"
                onClick={handleSaveInspection}
                disabled={!newInspectionName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
