"use client";

import { useState } from 'react';

// TypeScript interfaces for API responses
interface ClassificationResponse {
  title: string;
  narrative: string;
  severity: string;
  trade: string;
  action_type?: string;
  task_description?: string;
  labor_hours?: number;
  contractor_rate?: number;
  area_modifier?: number;
  materials?: MaterialItem[];
  materials_cost?: number;
  labor_cost?: number;
  estimated_cost?: number;
}

interface MaterialItem {
  label: string;
  unit_size: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
}

interface ExtractionResponse {
  status: string;
  inserted: number;
  failed: Array<{ file: string; error: string }>;
}

export default function DefectsPage() {
  // Mode state: 'classify' or 'extract'
  const [mode, setMode] = useState<'classify' | 'extract'>('classify');
  
  // Classification form state
  const [classifyFile, setClassifyFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [context, setContext] = useState('');
  const [includePricing, setIncludePricing] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [overheadProfitFactor, setOverheadProfitFactor] = useState('1.0');
  const [severityOverride, setSeverityOverride] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  
  // Extraction form state
  const [extractFiles, setExtractFiles] = useState<FileList | null>(null);
  const [extractCompanyId, setExtractCompanyId] = useState('');
  
  // Loading and results state
  const [isLoading, setIsLoading] = useState(false);
  const [classifyResult, setClassifyResult] = useState<ClassificationResponse | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle classification submission
  const handleClassifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!classifyFile || !companyId) {
      setError('Please provide an image and company ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setClassifyResult(null);

    try {
      const formData = new FormData();
      formData.append('file', classifyFile);
      formData.append('company_id', companyId);
      formData.append('context', context);
      formData.append('include_pricing', includePricing.toString());
      
      if (includePricing) {
        formData.append('zip_code', zipCode);
        formData.append('overhead_profit_factor', overheadProfitFactor);
        formData.append('severity_override', severityOverride);
        formData.append('state', state);
        formData.append('city', city);
      }

      const response = await fetch('http://localhost:8000/classify', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const result = await response.json();
      setClassifyResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle extraction submission
  const handleExtractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!extractFiles || extractFiles.length === 0 || !extractCompanyId) {
      setError('Please provide screenshots and company ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractResult(null);

    try {
      const formData = new FormData();
      formData.append('company_id', extractCompanyId);
      
      // Append all files
      for (let i = 0; i < extractFiles.length; i++) {
        formData.append('files', extractFiles[i]);
      }

      const response = await fetch('http://localhost:8000/extractor/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const result = await response.json();
      setExtractResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <style jsx>{`
        .gradient-btn {
          background: linear-gradient(135deg, rgb(75, 108, 183) 0%, rgb(106, 17, 203) 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(75, 108, 183, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .gradient-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(75, 108, 183, 0.4);
          background: linear-gradient(135deg, rgb(106, 17, 203) 0%, rgb(75, 108, 183) 100%);
        }
        .gradient-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .tab-btn {
          padding: 12px 24px;
          border: 2px solid #e5e7eb;
          background: white;
          color: #6b7280;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 14px;
        }
        .tab-btn:first-child {
          border-radius: 8px 0 0 8px;
        }
        .tab-btn:last-child {
          border-radius: 0 8px 8px 0;
        }
        .tab-btn.active {
          background: linear-gradient(135deg, rgb(75, 108, 183) 0%, rgb(106, 17, 203) 100%);
          color: white;
          border-color: rgb(75, 108, 183);
        }
        .tab-btn:hover:not(.active) {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .input-field {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.3s ease;
          background: white;
        }
        .input-field:focus {
          outline: none;
          border-color: rgb(75, 108, 183);
          box-shadow: 0 0 0 3px rgba(75, 108, 183, 0.1);
        }

        .file-input-label {
          display: inline-block;
          padding: 12px 24px;
          background: white;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          color: #6b7280;
          font-weight: 500;
        }
        .file-input-label:hover {
          border-color: rgb(75, 108, 183);
          background: #f9fafb;
          color: rgb(75, 108, 183);
        }

        .result-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-top: 24px;
        }

        .severity-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .severity-major_hazard {
          background: #fee2e2;
          color: #991b1b;
        }
        .severity-repair_needed {
          background: #fed7aa;
          color: #9a3412;
        }
        .severity-maintenance_minor {
          background: #dbeafe;
          color: #1e40af;
        }

        .materials-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        .materials-table th {
          background: #f9fafb;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
          border-bottom: 2px solid #e5e7eb;
        }
        .materials-table td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        .materials-table tr:hover {
          background: #f9fafb;
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            <i className="fas fa-exclamation-triangle mr-3" style={{ color: 'rgb(106, 17, 203)' }}></i>
            Defect Analysis
          </h1>
          <p className="text-gray-600">Classify defects or extract data from inspection screenshots</p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6 flex gap-0">
          <button
            className={`tab-btn ${mode === 'classify' ? 'active' : ''}`}
            onClick={() => {
              setMode('classify');
              setError(null);
              setClassifyResult(null);
              setExtractResult(null);
            }}
          >
            <i className="fas fa-clipboard-check mr-2"></i>
            Classify Defect
          </button>
          <button
            className={`tab-btn ${mode === 'extract' ? 'active' : ''}`}
            onClick={() => {
              setMode('extract');
              setError(null);
              setClassifyResult(null);
              setExtractResult(null);
            }}
          >
            <i className="fas fa-file-image mr-2"></i>
            Extract from Screenshots
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
            <div className="flex items-center">
              <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Classification Form */}
        {mode === 'classify' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              <i className="fas fa-camera mr-2" style={{ color: 'rgb(106, 17, 203)' }}></i>
              Classify Defect Image
            </h2>
            
            <form onSubmit={handleClassifySubmit} className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Defect Image *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setClassifyFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="classify-file-input"
                  required
                />
                <label htmlFor="classify-file-input" className="file-input-label w-full">
                  <i className="fas fa-cloud-upload-alt mr-2"></i>
                  {classifyFile ? classifyFile.name : 'Click to upload image'}
                </label>
              </div>

              {/* Company ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Company ID *
                </label>
                <input
                  type="text"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="input-field"
                  placeholder="Enter company ID"
                  required
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Context (Optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="Add any additional context about the defect..."
                />
              </div>

              {/* Include Pricing Checkbox */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="include-pricing"
                  checked={includePricing}
                  onChange={(e) => setIncludePricing(e.target.checked)}
                  className="w-5 h-5 cursor-pointer accent-purple-600"
                />
                <label htmlFor="include-pricing" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Include Pricing Information
                </label>
              </div>

              {/* Pricing Fields (conditionally shown) */}
              {includePricing && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Zip Code
                    </label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="input-field"
                      placeholder="e.g., 12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Overhead/Profit Factor
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={overheadProfitFactor}
                      onChange={(e) => setOverheadProfitFactor(e.target.value)}
                      className="input-field"
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="input-field"
                      placeholder="e.g., CA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input-field"
                      placeholder="e.g., Los Angeles"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Severity Override
                    </label>
                    <select
                      value={severityOverride}
                      onChange={(e) => setSeverityOverride(e.target.value)}
                      className="input-field"
                    >
                      <option value="">No override</option>
                      <option value="major_hazard">Major Hazard</option>
                      <option value="repair_needed">Repair Needed</option>
                      <option value="maintenance_minor">Maintenance/Minor</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="gradient-btn w-full py-4 text-base"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-search mr-2"></i>
                    Classify Defect
                  </>
                )}
              </button>
            </form>

            {/* Classification Results */}
            {classifyResult && (
              <div className="result-card">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  <i className="fas fa-check-circle text-green-500 mr-2"></i>
                  Classification Results
                </h3>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-1">Title</h4>
                    <p className="text-lg font-semibold text-gray-900">{classifyResult.title}</p>
                  </div>

                  {/* Narrative */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600 mb-1">Narrative</h4>
                    <p className="text-gray-700 leading-relaxed">{classifyResult.narrative}</p>
                  </div>

                  {/* Severity and Trade */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">Severity</h4>
                      <span className={`severity-badge severity-${classifyResult.severity}`}>
                        {classifyResult.severity.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">Trade</h4>
                      <p className="text-gray-900 font-medium">{classifyResult.trade}</p>
                    </div>
                  </div>

                  {/* Pricing Information */}
                  {classifyResult.estimated_cost !== undefined && (
                    <>
                      <hr className="my-6" />
                      
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        <i className="fas fa-dollar-sign mr-2" style={{ color: 'rgb(106, 17, 203)' }}></i>
                        Pricing Information
                      </h3>

                      {/* Action Type and Task Description */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">Action Type</h4>
                          <p className="text-gray-900 font-medium">{classifyResult.action_type}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">Labor Hours</h4>
                          <p className="text-gray-900 font-medium">{classifyResult.labor_hours?.toFixed(1)} hrs</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-600 mb-1">Task Description</h4>
                        <p className="text-gray-700">{classifyResult.task_description}</p>
                      </div>

                      {/* Materials Table */}
                      {classifyResult.materials && classifyResult.materials.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">Materials</h4>
                          <table className="materials-table">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Unit Size</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {classifyResult.materials.map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.label}</td>
                                  <td>{item.unit_size || '-'}</td>
                                  <td>{item.qty}</td>
                                  <td>${item.unit_price.toFixed(2)}</td>
                                  <td className="font-semibold">${item.line_total.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Cost Summary */}
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border-2 border-purple-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">Materials Cost</h4>
                            <p className="text-xl font-bold text-gray-900">${classifyResult.materials_cost?.toFixed(2)}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">Labor Cost</h4>
                            <p className="text-xl font-bold text-gray-900">${classifyResult.labor_cost?.toFixed(2)}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">Estimated Total</h4>
                            <p className="text-2xl font-bold" style={{ color: 'rgb(106, 17, 203)' }}>
                              ${classifyResult.estimated_cost?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extraction Form */}
        {mode === 'extract' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              <i className="fas fa-images mr-2" style={{ color: 'rgb(106, 17, 203)' }}></i>
              Extract from Screenshots
            </h2>
            
            <form onSubmit={handleExtractSubmit} className="space-y-6">
              {/* Company ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Company ID *
                </label>
                <input
                  type="text"
                  value={extractCompanyId}
                  onChange={(e) => setExtractCompanyId(e.target.value)}
                  className="input-field"
                  placeholder="Enter company ID"
                  required
                />
              </div>

              {/* File Upload (Multiple) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Screenshot Files *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setExtractFiles(e.target.files)}
                  className="hidden"
                  id="extract-file-input"
                  required
                />
                <label htmlFor="extract-file-input" className="file-input-label w-full">
                  <i className="fas fa-cloud-upload-alt mr-2"></i>
                  {extractFiles && extractFiles.length > 0
                    ? `${extractFiles.length} file(s) selected`
                    : 'Click to upload screenshots (multiple files)'}
                </label>
                {extractFiles && extractFiles.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {Array.from(extractFiles).map((file, idx) => (
                      <div key={idx} className="text-sm text-gray-600 flex items-center">
                        <i className="fas fa-file-image mr-2 text-purple-500"></i>
                        {file.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="gradient-btn w-full py-4 text-base"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Extracting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-download mr-2"></i>
                    Extract Data
                  </>
                )}
              </button>
            </form>

            {/* Extraction Results */}
            {extractResult && (
              <div className="result-card">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  <i className="fas fa-check-circle text-green-500 mr-2"></i>
                  Extraction Results
                </h3>

                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                      <h4 className="text-sm font-semibold text-gray-600 mb-1">Successfully Inserted</h4>
                      <p className="text-3xl font-bold text-green-700">{extractResult.inserted}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                      <h4 className="text-sm font-semibold text-gray-600 mb-1">Failed</h4>
                      <p className="text-3xl font-bold text-red-700">{extractResult.failed.length}</p>
                    </div>
                  </div>

                  {/* Errors */}
                  {extractResult.failed.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">Errors</h4>
                      <div className="space-y-2">
                        {extractResult.failed.map((err, idx) => (
                          <div key={idx} className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                            <p className="font-semibold text-red-900 text-sm">{err.file}</p>
                            <p className="text-red-700 text-sm">{err.error}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {extractResult.inserted > 0 && (
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                      <p className="text-green-800 font-medium">
                        <i className="fas fa-check-circle mr-2"></i>
                        {extractResult.inserted} defect example{extractResult.inserted !== 1 ? 's' : ''} successfully saved to Supabase!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


