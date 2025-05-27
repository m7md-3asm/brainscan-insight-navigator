
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileImage, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MRIFiles {
  t1: File | null;
  t2: File | null;
  t1ce: File | null;
  flair: File | null;
}

export const CaseUpload = () => {
  const [caseId, setCaseId] = useState('');
  const [files, setFiles] = useState<MRIFiles>({
    t1: null,
    t2: null,
    t1ce: null,
    flair: null
  });
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (modality: keyof MRIFiles, file: File | null) => {
    setFiles(prev => ({
      ...prev,
      [modality]: file
    }));
  };

  const handleDrop = useCallback((e: React.DragEvent, modality: keyof MRIFiles) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const niftiFile = droppedFiles.find(file => 
      file.name.toLowerCase().endsWith('.nii.gz') || 
      file.name.toLowerCase().endsWith('.nii')
    );
    
    if (niftiFile) {
      handleFileChange(modality, niftiFile);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (modality: keyof MRIFiles) => {
    handleFileChange(modality, null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!caseId.trim()) {
      toast({
        title: "Case ID Required",
        description: "Please enter a case ID",
        variant: "destructive",
      });
      return;
    }

    const uploadedFiles = Object.entries(files).filter(([_, file]) => file !== null);
    if (uploadedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please upload at least one MRI modality",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload to Flask server
      console.log('Uploading case:', caseId);
      console.log('Files:', uploadedFiles);
      
      // Here you would typically send to your Flask server
      // const formData = new FormData();
      // formData.append('case_id', caseId);
      // uploadedFiles.forEach(([modality, file]) => {
      //   formData.append(modality, file);
      // });
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Upload Successful",
        description: `Case ${caseId} uploaded successfully. Processing will begin shortly.`,
      });

      // Reset form
      setCaseId('');
      setFiles({ t1: null, t2: null, t1ce: null, flair: null });
      
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading the case. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const modalityInfo = {
    t1: { name: 'T1-weighted', description: 'Anatomical structure' },
    t2: { name: 'T2-weighted', description: 'Fluid detection' },
    t1ce: { name: 'T1 Contrast Enhanced', description: 'Tumor enhancement' },
    flair: { name: 'FLAIR', description: 'Lesion detection' }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload New Case
        </CardTitle>
        <CardDescription>
          Upload MRI modalities for brain tumor analysis. Supported formats: .nii, .nii.gz
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Case ID */}
          <div className="space-y-2">
            <Label htmlFor="caseId">Case ID</Label>
            <Input
              id="caseId"
              type="text"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Enter unique case identifier"
              required
            />
          </div>

          {/* File Upload Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(modalityInfo).map(([modality, info]) => (
              <div
                key={modality}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors"
                onDrop={(e) => handleDrop(e, modality as keyof MRIFiles)}
                onDragOver={handleDragOver}
              >
                <div className="text-center">
                  <FileImage className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <h3 className="font-medium text-gray-900">{info.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{info.description}</p>
                  
                  {files[modality as keyof MRIFiles] ? (
                    <div className="flex items-center justify-between bg-green-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-800">
                          {files[modality as keyof MRIFiles]!.name}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(modality as keyof MRIFiles)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept=".nii,.nii.gz"
                        onChange={(e) => handleFileChange(
                          modality as keyof MRIFiles,
                          e.target.files?.[0] || null
                        )}
                        className="hidden"
                        id={`file-${modality}`}
                      />
                      <label
                        htmlFor={`file-${modality}`}
                        className="cursor-pointer text-blue-600 hover:text-blue-800"
                      >
                        Click to select or drag & drop
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Upload Guidelines:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>At least one modality is required for processing</li>
                <li>T1CE is recommended for better tumor detection</li>
                <li>All modalities should be from the same patient session</li>
                <li>Files should be in NIfTI format (.nii or .nii.gz)</li>
              </ul>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading & Processing...' : 'Upload & Start Analysis'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
