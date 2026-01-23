"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImportExportSidebar } from "./_components/ImportExportSidebar";
import { ItemDetailsPanel } from "./_components/ItemDetailsPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ITemplateSection, ITemplateSubsection, ITemplateChecklist } from "@/src/models/Template";
import { useTemplatesQuery, useImportTemplateMutation, useExportTemplatesMutation } from "@/components/api/queries/templates";
import type { ITemplate } from "@/src/models/Template";

interface ExcelRow {
  sectionName: string;
  itemName: string;
  commentName: string;
  commentText: string;
  commentType: string; // info, limit, defect
  multipleChoiceOptions: string; // comma-separated
  unitTypeOptions: string; // comma-separated
  order: string | number;
  answerType: string; // boolean, checkbox, date, number, range, text
  defaultValue: string;
  defaultValue2: string; // for "range" types
  defaultUnitType: string; // for "number" and "range" types
  defaultLocation: string;
}

export default function ImportExportPage() {
  // Import tab state
  const [source, setSource] = useState<string>("");
  const [useNarrative, setUseNarrative] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<ExcelRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Export tab state
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const { data: templatesData, isLoading: isLoadingTemplates } = useTemplatesQuery();
  const templates = (templatesData?.data?.templates || []) as ITemplate[];

  // Mutations
  const importMutation = useImportTemplateMutation();
  const exportMutation = useExportTemplatesMutation();

  // Group data by section name, then by item name
  const groupedData = useMemo(() => {
    const grouped = new Map<string, Map<string, ExcelRow[]>>();
    
    parsedData.forEach((row) => {
      const sectionName = row.sectionName || "(No Section)";
      const itemName = row.itemName || "(No Item)";
      
      if (!grouped.has(sectionName)) {
        grouped.set(sectionName, new Map());
      }
      
      const sectionMap = grouped.get(sectionName)!;
      if (!sectionMap.has(itemName)) {
        sectionMap.set(itemName, []);
      }
      
      sectionMap.get(itemName)!.push(row);
    });
    
    return grouped;
  }, [parsedData]);

  // Auto-select first section and item when data is parsed
  useEffect(() => {
    if (groupedData.size > 0 && !selectedSection) {
      const firstSection = Array.from(groupedData.keys())[0];
      if (firstSection) {
        const itemsMap = groupedData.get(firstSection);
        if (itemsMap && itemsMap.size > 0) {
          const firstItem = Array.from(itemsMap.keys())[0];
          setSelectedSection(firstSection);
          if (firstItem) {
            setSelectedItem(firstItem);
          }
        }
      }
    }
  }, [groupedData, selectedSection]);

  // Get selected item data
  const selectedItemData = useMemo(() => {
    if (!selectedSection || !selectedItem) return null;
    const sectionMap = groupedData.get(selectedSection);
    if (!sectionMap) return null;
    return sectionMap.get(selectedItem) || null;
  }, [groupedData, selectedSection, selectedItem]);

  const parseExcelFile = async (file: File): Promise<ExcelRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("Failed to read file"));
            return;
          }

          const workbook = XLSX.read(data, { type: "binary" });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            reject(new Error("Excel file has no worksheets"));
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

          if (jsonData.length < 2) {
            reject(new Error("Excel file must have at least a header row and one data row"));
            return;
          }

          // Get header row (first row)
          const headers = jsonData[0].map((h: any) => String(h || "").trim().toLowerCase());
          
          // Create column mapping (case-insensitive)
          // Expected columns map to Template model fields:
          // - section name → ITemplateSection.name
          // - item name → ITemplateSubsection.name
          // - comment name → ITemplateChecklist.name
          // - comment text → ITemplateChecklist.comment
          // - comment type → ITemplateChecklist.type (info→information, limit→status, defect→defects)
          // - multiple choice options → ITemplateChecklist.answerChoices
          // - unit type options → ITemplateChecklist.answerChoices
          // - order → ITemplateChecklist.orderIndex
          // - answer type → ITemplateChecklist.field
          // - default location → ITemplateChecklist.location
          const columnMap: Record<string, number> = {};
          const expectedColumns = [
            "section name",
            "item name",
            "comment name",
            "comment text",
            "comment type",
            "multiple choice options",
            "unit type options",
            "order",
            "answer type",
            "default value",
            "default value 2",
            "default unit type",
            "default location"
          ];

          expectedColumns.forEach((col) => {
            // First try exact match
            let index = headers.findIndex((h) => h === col);
            
            // If no exact match, try to find columns that start with the base name
            // This handles cases like "comment type (info, limit, defect)"
            // or "multiple choice options (comma-separated)"
            if (index === -1) {
              index = headers.findIndex((h) => {
                // Check if header starts with the column name
                if (h.startsWith(col)) {
                  // Make sure it's followed by space and optional parentheses, or end of string
                  const remaining = h.substring(col.length).trim();
                  return remaining === "" || remaining.startsWith("(");
                }
                return false;
              });
            }
            
            // If still no match, try a more flexible approach: normalize by removing parentheses content
            if (index === -1) {
              const normalizedCol = col.toLowerCase();
              index = headers.findIndex((h) => {
                // Remove everything in parentheses from header for comparison
                const normalizedHeader = h.replace(/\s*\([^)]*\)/g, "").trim();
                return normalizedHeader === normalizedCol;
              });
            }
            
            if (index !== -1) {
              columnMap[col] = index;
            }
          });

          // Extract data rows (starting from row 2)
          const rows: ExcelRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue; // Skip empty rows

            const excelRow: ExcelRow = {
              sectionName: String(row[columnMap["section name"]] || "").trim(),
              itemName: String(row[columnMap["item name"]] || "").trim(),
              commentName: String(row[columnMap["comment name"]] || "").trim(),
              commentText: String(row[columnMap["comment text"]] || "").trim(),
              commentType: String(row[columnMap["comment type"]] || "").trim(),
              multipleChoiceOptions: String(row[columnMap["multiple choice options"]] || "").trim(),
              unitTypeOptions: String(row[columnMap["unit type options"]] || "").trim(),
              order: row[columnMap["order"]] !== undefined ? row[columnMap["order"]] : "",
              answerType: String(row[columnMap["answer type"]] || "").trim(),
              defaultValue: String(row[columnMap["default value"]] || "").trim(),
              defaultValue2: String(row[columnMap["default value 2"]] || "").trim(),
              defaultUnitType: String(row[columnMap["default unit type"]] || "").trim(),
              defaultLocation: String(row[columnMap["default location"]] || "").trim(),
            };

            // Only add row if it has at least some data
            if (excelRow.sectionName || excelRow.itemName || excelRow.commentName) {
              rows.push(excelRow);
            }
          }

          if (rows.length === 0) {
            reject(new Error("No valid data rows found in Excel file"));
            return;
          }

          resolve(rows);
        } catch (error: any) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsBinaryString(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validExtensions = [".xls", ".xlsx"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error("Please select a valid Excel file (.xls or .xlsx)");
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 10MB limit. Please select a smaller file.");
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    setParsedData([]);
    setSelectedSection(null);
    setSelectedItem(null);

    try {
      const data = await parseExcelFile(file);
      setParsedData(data);
      if (data.length === 0) {
        setParseError("No valid data rows found in Excel file");
      }
    } catch (error: any) {
      setParseError(error.message || "Failed to parse Excel file");
      console.error("Excel parsing error:", error);
      toast.error(error.message || "Failed to parse Excel file");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSectionSelect = (section: string | null) => {
    setSelectedSection(section);
    setSelectedItem(null);
  };

  const handleItemSelect = (section: string, item: string) => {
    setSelectedSection(section);
    setSelectedItem(item);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Transform commentType from Excel to Template model
  // info → status, limit → information, defect → defects
  const transformCommentType = (commentType: string): 'status' | 'information' | 'defects' => {
    const normalized = commentType.toLowerCase().trim();
    if (normalized === 'info') return 'status';
    if (normalized === 'limit') return 'information';
    if (normalized === 'defect') return 'defects';
    // Default fallback
    return 'information';
  };

  // Transform answerType from Excel to Template model field
  // boolean → checkbox, checkbox → multipleAnswers, date → date, number → number, range → numberRange, text → text
  const transformAnswerType = (answerType: string): 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'text' | undefined => {
    const normalized = answerType.toLowerCase().trim();
    const mapping: Record<string, 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'text'> = {
      'boolean': 'checkbox',
      'checkbox': 'multipleAnswers',
      'date': 'date',
      'number': 'number',
      'range': 'numberRange',
      'text': 'text',
    };
    return mapping[normalized];
  };

  // Parse comma-separated string to array
  const parseCommaSeparated = (value: string): string[] => {
    if (!value || !value.trim()) return [];
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  };

  // Parse order to number
  const parseOrder = (order: string | number): number => {
    if (typeof order === 'number') return order;
    const parsed = parseInt(String(order), 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Parse boolean from string
  const parseBoolean = (value: string): boolean => {
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  };

  // Parse number from string
  const parseNumber = (value: string): number | undefined => {
    if (!value || !value.trim()) return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  // Parse date from string
  const parseDate = (value: string): Date | undefined => {
    if (!value || !value.trim()) return undefined;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  };

  // Transform Excel row to Template Checklist
  const transformChecklist = (row: ExcelRow): ITemplateChecklist => {
    const field = transformAnswerType(row.answerType);
    const type = transformCommentType(row.commentType);
    
    // Determine answerChoices - prefer multipleChoiceOptions, fallback to unitTypeOptions
    let answerChoices: string[] | undefined = undefined;
    if (row.multipleChoiceOptions && row.multipleChoiceOptions.trim()) {
      answerChoices = parseCommaSeparated(row.multipleChoiceOptions);
    } else if (row.unitTypeOptions && row.unitTypeOptions.trim()) {
      answerChoices = parseCommaSeparated(row.unitTypeOptions);
    }

    const checklist: ITemplateChecklist = {
      type,
      name: row.commentName.trim(),
      orderIndex: parseOrder(row.order),
      field: (type === 'status' || type === 'information') ? field : undefined,
      location: row.defaultLocation?.trim() || undefined,
      comment: row.commentText?.trim() || undefined,
      answerChoices: answerChoices && answerChoices.length > 0 ? answerChoices : undefined,
    };

    // Map defaultValue based on field type
    if (field && row.defaultValue) {
      switch (field) {
        case 'checkbox':
          checklist.defaultChecked = parseBoolean(row.defaultValue);
          break;
        case 'multipleAnswers':
          checklist.selectedAnswers = parseCommaSeparated(row.defaultValue);
          break;
        case 'date':
          checklist.dateAnswer = parseDate(row.defaultValue);
          break;
        case 'number':
          checklist.numberAnswer = parseNumber(row.defaultValue);
          if (row.defaultUnitType?.trim()) {
            checklist.numberUnit = row.defaultUnitType.trim();
          }
          break;
        case 'numberRange':
          checklist.rangeFrom = parseNumber(row.defaultValue);
          if (row.defaultValue2?.trim()) {
            checklist.rangeTo = parseNumber(row.defaultValue2);
          }
          if (row.defaultUnitType?.trim()) {
            checklist.rangeUnit = row.defaultUnitType.trim();
          }
          break;
        case 'text':
          checklist.textAnswer = row.defaultValue.trim();
          break;
      }
    }

    return checklist;
  };

  // Handle import submit
  const handleSubmit = async () => {
    if (!selectedFile || parsedData.length === 0) {
      toast.error('Please upload and parse a file first');
      return;
    }

    if (!source) {
      toast.error('Please select a source');
      return;
    }

    // Extract template name from file name (remove extension)
    const templateName = selectedFile.name.replace(/\.[^/.]+$/, '').trim();
    
    if (!templateName) {
      toast.error('Template name cannot be empty');
      return;
    }

    importMutation.mutate(
      {
        templateName,
        data: parsedData,
        source: source, // 'report-writer' or 'spectora'
        useNarrative,
      },
      {
        onSuccess: () => {
          // Reset form
          setSelectedFile(null);
          setParsedData([]);
          setSelectedSection(null);
          setSelectedItem(null);
          setSource("");
        },
      }
    );
  };

  // Handle export
  const handleExport = () => {
    if (selectedTemplateIds.size === 0) {
      toast.error('Please select at least one template to export');
      return;
    }

    exportMutation.mutate(
      {
        templateIds: Array.from(selectedTemplateIds),
      },
      {
        onSuccess: () => {
          setSelectedTemplateIds(new Set());
        },
      }
    );
  };

  // Handle template selection
  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  // Handle select all templates
  const handleSelectAll = () => {
    if (selectedTemplateIds.size === templates.length) {
      setSelectedTemplateIds(new Set());
    } else {
      setSelectedTemplateIds(new Set(templates.map((t) => {
        const id = t._id;
        return id ? (typeof id === 'string' ? id : id.toString()) : '';
      }).filter(Boolean)));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import or Export</h2>
        <p className="text-muted-foreground">
          Import or export templates using Excel files
        </p>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Templates</CardTitle>
              <CardDescription>
                Select templates to export as Excel files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground ml-2">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No templates available to export</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedTemplateIds.size === templates.length && templates.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                      <Label
                        htmlFor="select-all"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Select All ({selectedTemplateIds.size} of {templates.length} selected)
                      </Label>
                    </div>
                    <Button
                      onClick={handleExport}
                      disabled={selectedTemplateIds.size === 0 || exportMutation.isPending}
                      className="min-w-[120px]"
                    >
                      {exportMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
                    {templates.map((template) => {
                      const templateId = template._id 
                        ? (typeof template._id === 'string' ? template._id : template._id.toString())
                        : '';
                      if (!templateId) return null;
                      const isSelected = selectedTemplateIds.has(templateId);
                      return (
                        <div
                          key={templateId}
                          className={cn(
                            "flex items-center space-x-3 p-4 hover:bg-accent transition-colors",
                            isSelected && "bg-accent"
                          )}
                        >
                          <Checkbox
                            id={`template-${templateId}`}
                            checked={isSelected}
                            onCheckedChange={() => handleTemplateToggle(templateId)}
                          />
                          <Label
                            htmlFor={`template-${templateId}`}
                            className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.sections?.length || 0} section(s) • Created {new Date(template.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Configure your import/export settings
              </CardDescription>
            </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="source">
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="report-writer">Report Writer AI</SelectItem>
                <SelectItem value="spectora">Spectora</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {source && (
            <>
              {source === 'spectora' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-narrative"
                    checked={useNarrative}
                    onCheckedChange={(checked) => setUseNarrative(checked === true)}
                  />
                  <Label
                    htmlFor="use-narrative"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Use Narrative for AI training
                  </Label>
                </div>
              )}

              <div className="space-y-2">
                <Label>Upload File</Label>
                <div
                  onClick={handleClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    selectedFile && "border-primary"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center space-y-4">
                    {selectedFile ? (
                      <>
                        <FileSpreadsheet className="h-12 w-12 text-primary" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Click to select a different file
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Drag and drop your Excel file here
                          </p>
                          <p className="text-xs text-muted-foreground">
                            or click to browse
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Supports .xls and .xlsx files
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Parsed Data Display */}
      {isParsing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Parsing Excel file...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {parseError && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Error parsing file</p>
                <p className="text-sm text-destructive/80 mt-1">{parseError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {!isParsing && !parseError && parsedData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit} 
                disabled={importMutation.isPending}
                className="min-w-[120px]"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Template'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Data Display with Sidebar */}
      {!isParsing && !parseError && parsedData.length > 0 && (
        <div className="flex flex-col min-h-[600px] w-full">
          {isMobile ? (
            // Mobile: Vertical layout - sidebar on top, details below
            <div className="flex flex-col flex-1 min-h-0">
              <div className="border-b bg-sidebar text-sidebar-foreground overflow-y-auto max-h-[40vh] shrink-0">
                <ImportExportSidebar
                  groupedData={groupedData}
                  selectedSection={selectedSection}
                  selectedItem={selectedItem}
                  onSectionSelect={handleSectionSelect}
                  onItemSelect={handleItemSelect}
                />
              </div>
              <div className="flex flex-col flex-1 min-h-0 bg-background overflow-y-auto">
                <ItemDetailsPanel
                  itemData={selectedItemData}
                  sectionName={selectedSection}
                  itemName={selectedItem}
                />
              </div>
            </div>
          ) : (
            // Desktop: Horizontal resizable layout
            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
                <ImportExportSidebar
                  groupedData={groupedData}
                  selectedSection={selectedSection}
                  selectedItem={selectedItem}
                  onSectionSelect={handleSectionSelect}
                  onItemSelect={handleItemSelect}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={80} minSize={60} maxSize={85}>
                <div className="flex flex-col min-w-0 bg-background h-full">
                  <ItemDetailsPanel
                    itemData={selectedItemData}
                    sectionName={selectedSection}
                    itemName={selectedItem}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
