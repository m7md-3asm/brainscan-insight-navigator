
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProcessingCase {
  case_id: string;
  status: 'processing' | 'done' | 'error' | 'cancelled';
  date: string;
  progress?: {
    percentage: number;
    step: string;
    message: string;
    details?: any;
  };
  results?: {
    tumor_detection: string;
    tumor_probability: string;
    tumor_type: string;
    glioma_grade: string;
    scan_file: string;
    segmentation_file: string;
  };
  error?: string;
}

export const ProcessingStatus = () => {
  const [processingCases, setProcessingCases] = useState<ProcessingCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCases = async () => {
    try {
      const response = await fetch('http://localhost:5000/cases');
      const data = await response.json();
      
      if (data.cases) {
        // Filter for processing, recent completed, or error cases
        const relevantCases = data.cases.filter((case_: any) => 
          case_.status === 'processing' || 
          case_.status === 'error' ||
          case_.status === 'cancelled' ||
          (case_.status === 'done' && isRecentCase(case_.date))
        );

        // Fetch detailed info for each relevant case
        const casesWithDetails = await Promise.all(
          relevantCases.map(async (case_: any) => {
            try {
              const resultResponse = await fetch(`http://localhost:5000/api/results/${case_.case_id}`);
              const resultData = await resultResponse.json();
              
              return {
                ...case_,
                progress: resultData.status === 'processing' ? {
                  percentage: resultData.percentage || 0,
                  step: resultData.step || 'Processing...',
                  message: resultData.message || 'Processing...',
                  details: resultData.details
                } : undefined,
                results: resultData.status === 'done' ? resultData : undefined,
                error: resultData.status === 'error' ? resultData.error : undefined
              };
            } catch (error) {
              console.error(`Error fetching details for case ${case_.case_id}:`, error);
              return case_;
            }
          })
        );

        setProcessingCases(casesWithDetails);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to the processing server. Please ensure the Flask backend is running on localhost:5000",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isRecentCase = (dateString: string) => {
    const caseDate = new Date(dateString);
    const now = new Date();
    const hoursDiff = (now.getTime() - caseDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  };

  const cancelCase = async (caseId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/case/${caseId}/cancel`, {
        method: 'POST',
      });
      
      if (response.ok) {
        toast({
          title: "Processing Cancelled",
          description: `Case ${caseId} has been cancelled`,
        });
        fetchCases();
      } else {
        throw new Error('Failed to cancel processing');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel processing",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    fetchCases();
    
    // Auto-refresh every 3 seconds for processing cases
    const interval = setInterval(() => {
      if (processingCases.some(c => c.status === 'processing')) {
        fetchCases();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [processingCases]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading processing status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Processing Status</h2>
          <p className="text-gray-600">Monitor active and recent processing jobs</p>
        </div>
        <Button variant="outline" onClick={fetchCases} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {processingCases.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No active processing jobs</p>
              <p className="text-sm">Upload a new case to start processing</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {processingCases.map((case_) => (
            <Card key={case_.case_id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(case_.status)}
                    <div>
                      <CardTitle className="text-lg">{case_.case_id}</CardTitle>
                      <CardDescription>Started: {case_.date}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(case_.status)}>
                      {case_.status.charAt(0).toUpperCase() + case_.status.slice(1)}
                    </Badge>
                    {case_.status === 'processing' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => cancelCase(case_.case_id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {case_.status === 'processing' && case_.progress && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{case_.progress.step}</span>
                      <span>{case_.progress.percentage}%</span>
                    </div>
                    <Progress value={case_.progress.percentage} className="w-full" />
                    <p className="text-sm text-gray-600">{case_.progress.message}</p>
                  </div>
                )}

                {case_.status === 'done' && case_.results && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Tumor Detection:</span>
                        <p className={case_.results.tumor_detection === 'No Tumor' ? 'text-green-600' : 'text-red-600'}>
                          {case_.results.tumor_detection}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Confidence:</span>
                        <p>{case_.results.tumor_probability}</p>
                      </div>
                      {case_.results.tumor_detection !== 'No Tumor' && (
                        <>
                          <div>
                            <span className="font-medium">Tumor Type:</span>
                            <p>{case_.results.tumor_type}</p>
                          </div>
                          <div>
                            <span className="font-medium">Grade:</span>
                            <p>{case_.results.glioma_grade}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {case_.results.segmentation_file && (
                      <div className="text-sm">
                        <span className="font-medium">Segmentation:</span>
                        <p className="text-green-600">✓ Generated</p>
                      </div>
                    )}
                  </div>
                )}

                {case_.status === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center gap-2 text-red-700">
                      <XCircle className="w-4 h-4" />
                      <span className="font-medium">Processing Error</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">{case_.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
