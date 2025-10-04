"use client";
import React, { useEffect, useState, useCallback } from 'react';

interface ISectionChecklist { _id: string; text: string; order_index: number; }
interface ISectionComment { _id: string; text: string; order_index: number; }
interface ISection { _id: string; name: string; order_index: number; checklists: ISectionChecklist[]; comments: ISectionComment[]; }

interface IBlockImage { url: string; annotations?: string; }
interface IInformationBlock {
  _id: string;
  inspection_id: string;
  section_id: ISection | string;
  selected_checklist_ids: ISectionChecklist[] | string[];
  selected_comment_ids: ISectionComment[] | string[];
  custom_text?: string;
  images: IBlockImage[];
}

interface AddBlockFormState {
  section_id: string;
  selected_checklist_ids: Set<string>;
  selected_comment_ids: Set<string>;
  custom_text: string;
}

interface InformationSectionsProps {
  inspectionId: string;
}

const InformationSections: React.FC<InformationSectionsProps> = ({ inspectionId }) => {
  const [sections, setSections] = useState<ISection[]>([]);
  const [blocks, setBlocks] = useState<IInformationBlock[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ISection | null>(null);
  const [formState, setFormState] = useState<AddBlockFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    setError(null);
    try {
      const res = await fetch('/api/information-sections/sections');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load sections');
      setSections(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  const fetchBlocks = useCallback(async () => {
    if (!inspectionId) return;
    setLoadingBlocks(true);
    try {
      const res = await fetch(`/api/information-sections/${inspectionId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load information blocks');
      setBlocks(json.data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingBlocks(false);
    }
  }, [inspectionId]);

  useEffect(() => { fetchSections(); }, [fetchSections]);
  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const openAddModal = (section: ISection) => {
    setActiveSection(section);
    setFormState({
      section_id: section._id,
      selected_checklist_ids: new Set(),
      selected_comment_ids: new Set(),
      custom_text: '',
    });
    setModalOpen(true);
  };

  const toggleChecklist = (id: string) => {
    if (!formState) return;
    const setIds = new Set(formState.selected_checklist_ids);
    setIds.has(id) ? setIds.delete(id) : setIds.add(id);
    setFormState({ ...formState, selected_checklist_ids: setIds });
  };

  const toggleComment = (id: string) => {
    if (!formState) return;
    const setIds = new Set(formState.selected_comment_ids);
    setIds.has(id) ? setIds.delete(id) : setIds.add(id);
    setFormState({ ...formState, selected_comment_ids: setIds });
  };

  const handleSave = async () => {
    if (!formState || !inspectionId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/information-sections/${inspectionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: formState.section_id,
          selected_checklist_ids: Array.from(formState.selected_checklist_ids),
          selected_comment_ids: Array.from(formState.selected_comment_ids),
          custom_text: formState.custom_text,
          images: [],
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save block');
      
      // Refresh blocks
      await fetchBlocks();
      setModalOpen(false);
      setActiveSection(null);
      setFormState(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sectionBlocks = (sectionId: string) =>
    blocks.filter(b => (typeof b.section_id === 'string' ? b.section_id === sectionId : (b.section_id as ISection)._id === sectionId));

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Information Sections</h2>
      {loadingSections && <div>Loading sections...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sections.map(section => (
          <div key={section._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontWeight: 500, fontSize: '1rem' }}>{section.name}</h3>
              <button
                onClick={() => openAddModal(section)}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem', borderRadius: '0.25rem', backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                Add Information Block
              </button>
            </div>

            {/* Existing blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {loadingBlocks && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading blocks...</div>}
              {sectionBlocks(section._id).map(block => (
                <div key={block._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.25rem', padding: '0.75rem', backgroundColor: '#f9fafb' }}>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Selected Checklists:</div>
                    <ul style={{ listStyleType: 'disc', marginLeft: '1.25rem', marginBottom: '0.5rem' }}>
                      {(block.selected_checklist_ids as any[]).map((cl: any) => (
                        <li key={cl._id || cl}>{cl.text || cl}</li>
                      ))}
                    </ul>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Selected Comments:</div>
                    <ul style={{ listStyleType: 'disc', marginLeft: '1.25rem', marginBottom: '0.5rem' }}>
                      {(block.selected_comment_ids as any[]).map((cm: any) => (
                        <li key={cm._id || cm}>{cm.text || cm}</li>
                      ))}
                    </ul>
                    {block.custom_text && (
                      <div style={{ marginTop: '0.5rem' }}><span style={{ fontWeight: 600 }}>Custom Text:</span> {block.custom_text}</div>
                    )}
                  </div>
                </div>
              ))}
              {sectionBlocks(section._id).length === 0 && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>No information blocks yet.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && activeSection && formState && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '42rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontWeight: 600, fontSize: '1.125rem' }}>Add Information Block - {activeSection.name}</h4>
              <button onClick={() => { setModalOpen(false); setActiveSection(null); }} style={{ color: '#6b7280', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.25rem' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h5 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Checklists</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.5rem' }}>
                  {activeSection.checklists.map(cl => (
                    <label key={cl._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={formState.selected_checklist_ids.has(cl._id)}
                        onChange={() => toggleChecklist(cl._id)}
                      />
                      <span>{cl.text}</span>
                    </label>
                  ))}
                  {activeSection.checklists.length === 0 && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No checklists</div>}
                </div>
              </div>
              <div>
                <h5 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Comments</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.5rem' }}>
                  {activeSection.comments.map(cm => (
                    <label key={cm._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={formState.selected_comment_ids.has(cm._id)}
                        onChange={() => toggleComment(cm._id)}
                      />
                      <span>{cm.text.length > 100 ? cm.text.slice(0,100) + '…' : cm.text}</span>
                    </label>
                  ))}
                  {activeSection.comments.length === 0 && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No comments</div>}
                </div>
              </div>
              <div>
                <h5 style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Custom Text</h5>
                <textarea
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.25rem', padding: '0.5rem', fontSize: '0.875rem', minHeight: '100px' }}
                  value={formState.custom_text}
                  onChange={e => setFormState({ ...formState, custom_text: e.target.value })}
                  placeholder="Enter custom notes or details..."
                />
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => { setModalOpen(false); setActiveSection(null); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.25rem', backgroundColor: '#e5e7eb', border: 'none', cursor: 'pointer' }}
                disabled={saving}
                onMouseOver={(e) => !saving && (e.currentTarget.style.backgroundColor = '#d1d5db')}
                onMouseOut={(e) => !saving && (e.currentTarget.style.backgroundColor = '#e5e7eb')}
              >Cancel</button>
              <button
                onClick={handleSave}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.25rem', backgroundColor: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onMouseOver={(e) => !saving && (e.currentTarget.style.backgroundColor = '#15803d')}
                onMouseOut={(e) => !saving && (e.currentTarget.style.backgroundColor = '#16a34a')}
              >{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InformationSections;
