
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FolderOpen, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const CaseUpload = () => {
  const [caseId, setCaseId] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [detectedScans, setDetectedScans] = useState<{[key: string]: string}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const requiredScans = ['T1', 'T2'];
  const optionalScans = ['T1CE', 'FLAIR'];
  const allScans = [...requiredScans, ...optionalScans];

  const detectScanTypes = (fileList: FileList) => {
    const detected: {[key: string]: string} = {};
    
    Array.from(fileList).forEach(file => {
      const filename = file.name.toLowerCase();
      
      // Match your Flask detection logic
      if (filename.includes('t1') && !filename.includes('ce') && !filename.includes('t10')) {
        detected['T1'] = file.name;
      } else if (filename.includes('t2') && !filename.includes('t2*') && !filename.includes('t20')) {
        detected['T2'] = file.name;
      } else if (filename.includes('t1ce') || filename.includes('t1_ce') || filename.includes('t1-ce')) {
        detected['T1CE'] = file.name;
      } else if (filename.includes('flair')) {
        detected['FLAIR'] = file.name;
      }
    });
    
    return detected;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles);
      const detected = detectScanTypes(selectedFiles);
      setDetectedScans(detected);
    }
  };

  const handleFolderSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.webkitdirectory = true;
      fileInputRef.current.click();
    }
  };

  const validateCaseId = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:5000/check_case_id/${id}`);
      const data = await response.json();
      return !data.exists;
    } catch (error) {
      console.error('Error checking case ID:', error);
      return true;
    }
  };

  const handleUpload = async () => {
    if (!caseId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a case ID",
        variant: "destructive",
      });
      return;
    }

    if (!files || files.length === 0) {
      toast({
        title: "Error",
        description: "Please select MRI scan files",
        variant: "destructive",
      });
      return;
    }

    // Validate case ID is unique
    const isUnique = await validateCaseId(caseId);
    if (!isUnique) {
      toast({
        title: "Error",
        description: "Case ID already exists. Please choose a different ID.",
        variant: "destructive",
      });
      return;
    }

    // Check if required scans are present
    const missingRequired = requiredScans.filter(scan => !detectedScans[scan]);
    if (missingRequired.length > 0) {
      toast({
        title: "Missing Required Scans",
        description: `Please include: ${missingRequired.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('case_id', caseId);
      
      // Add all files
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Upload Successful",
          description: "Processing started. Check the Processing tab for updates.",
        });
        
        // Reset form
        setCaseId('');
        setFiles(null);
        setDetectedScans({});
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.webkitdirectory = false;
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getScanStatus = (scanType: string) => {
    if (detectedScans[scanType]) {
      return { icon: CheckCircle, color: 'text-green-600', status: 'Found' };
    } else if (requiredScans.includes(scanType)) {
      return { icon: AlertCircle, color: 'text-red-600', status: 'Required' };
    } else {
      return { icon: FileText, color: 'text-gray-400', status: 'Optional' };
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload New Case
          </CardTitle>
          <CardDescription>
            Upload MRI scans for brain tumor detection and analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Case ID Input */}
          <div className="space-y-2">
            <Label htmlFor="caseId">Case ID</Label>
            <Input
              id="caseId"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Enter unique case identifier (e.g., CASE_001)"
              disabled={isUploading}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleFolderSelect}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Select Case Folder
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".nii.gz,.nii"
              onChange={handleFileSelect}
              className="hidden"
            />

            {files && files.length > 0 && (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  {files.length} files selected from folder
                </div>

                {/* Scan Detection Status */}
                <div className="grid grid-cols-2 gap-4">
                  {allScans.map(scanType => {
                    const { icon: Icon, color, status } = getScanStatus(scanType);
                    return (
                      <div key={scanType} className="flex items-center gap-2 p-2 border rounded">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="font-medium">{scanType}</span>
                        <span className={`text-sm ${color}`}>
                          {detectedScans[scanType] ? '✓' : status}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Missing Required Files Warning */}
                {requiredScans.some(scan => !detectedScans[scan]) && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div className="text-sm text-red-700">
                      <strong>Missing required scans:</strong> {requiredScans.filter(scan => !detectedScans[scan]).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={isUploading || !caseId.trim() || !files || requiredScans.some(scan => !detectedScans[scan])}
            className="w-full"
          >
            {isUploading ? 'Uploading and Processing...' : 'Upload and Start Analysis'}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Required:</strong> T1 and T2 weighted scans (.nii or .nii.gz)</span>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
            <span><strong>Optional:</strong> T1CE (contrast-enhanced) and FLAIR scans</span>
          </div>
          <div className="flex items-start gap-2">
            <FolderOpen className="w-4 h-4 text-purple-600 mt-0.5" />
            <span><strong>Tip:</strong> Select the entire case folder containing all MRI modalities</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
