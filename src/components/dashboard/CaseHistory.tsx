import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, Brain, FileText, Download, Eye, RefreshCw, FolderDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CaseRecord {
  case_id: string;
  status: 'done' | 'error' | 'processing' | 'cancelled';
  date: string;
  results?: {
    tumor_detection: string;
    tumor_probability: string;
    tumor_type: string;
    glioma_grade: string;
    scan_file: string;
    segmentation_file: string;
  };
}

export const CaseHistory = () => {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [filteredCases, setFilteredCases] = useState<CaseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const { toast } = useToast();

  const fetchCases = async () => {
    try {
      const response = await fetch('http://localhost:5000/cases');
      const data = await response.json();
      
      if (data.cases) {
        // Fetch detailed results for completed cases
        const casesWithResults = await Promise.all(
          data.cases.map(async (case_: any) => {
            if (case_.status === 'done') {
              try {
                const resultResponse = await fetch(`http://localhost:5000/api/results/${case_.case_id}`);
                const resultData = await resultResponse.json();
                return {
                  ...case_,
                  results: resultData.status === 'done' ? resultData : undefined
                };
              } catch (error) {
                console.error(`Error fetching results for case ${case_.case_id}:`, error);
                return case_;
              }
            }
            return case_;
          })
        );

        setCases(casesWithResults);
        setFilteredCases(casesWithResults);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
      toast({
        title: "Error",
        description: "Failed to fetch case history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredCases(cases);
    } else {
      const filtered = cases.filter(case_ =>
        case_.case_id.toLowerCase().includes(term.toLowerCase()) ||
        (case_.results?.tumor_type && case_.results.tumor_type.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredCases(filtered);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadResults = (caseId: string) => {
    const url = `http://localhost:5000/results/${caseId}/results.txt`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseId}_results.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCaseFolder = async (caseId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/download-case/${caseId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download case folder');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${caseId}_complete_case.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Complete case folder for ${caseId} is being downloaded`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download case folder",
        variant: "destructive",
      });
    }
  };

  const viewCase = (case_: CaseRecord) => {
    setSelectedCase(case_);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading case history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Case History</h2>
          <p className="text-gray-600">View and manage processed cases</p>
        </div>
        <Button variant="outline" onClick={fetchCases} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search cases by ID or tumor type..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{cases.length}</div>
            <div className="text-sm text-gray-600">Total Cases</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {cases.filter(c => c.status === 'done').length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {cases.filter(c => c.results?.tumor_detection !== 'No Tumor' && c.results?.tumor_detection).length}
            </div>
            <div className="text-sm text-gray-600">Tumors Detected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {cases.filter(c => c.status === 'processing').length}
            </div>
            <div className="text-sm text-gray-600">Processing</div>
          </CardContent>
        </Card>
      </div>

      {/* Case List */}
      <div className="space-y-4">
        {filteredCases.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No cases found</p>
                <p className="text-sm">
                  {searchTerm ? 'Try adjusting your search terms' : 'Upload your first case to get started'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredCases.map((case_) => (
            <Card key={case_.case_id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{case_.case_id}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {case_.date}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(case_.status)}>
                      {case_.status.charAt(0).toUpperCase() + case_.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {case_.results && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Detection:</span>
                        <p className={`font-medium ${
                          case_.results.tumor_detection === 'No Tumor' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {case_.results.tumor_detection}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Confidence:</span>
                        <p className="font-medium">{case_.results.tumor_probability}</p>
                      </div>
                      {case_.results.tumor_detection !== 'No Tumor' && (
                        <>
                          <div>
                            <span className="font-medium text-gray-600">Type:</span>
                            <p className="font-medium">{case_.results.tumor_type}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Grade:</span>
                            <p className="font-medium">{case_.results.glioma_grade}</p>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => viewCase(case_)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadResults(case_.case_id)}
                        className="flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Report
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadCaseFolder(case_.case_id)}
                        className="flex items-center gap-1"
                      >
                        <FolderDown className="w-4 h-4" />
                        Complete Case
                      </Button>
                    </div>
                  </div>
                )}

                {case_.status === 'error' && (
                  <div className="text-sm text-red-600">
                    Processing failed. Check logs for details.
                  </div>
                )}

                {case_.status === 'processing' && (
                  <div className="text-sm text-blue-600">
                    Currently being processed...
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Case Details: {selectedCase.case_id}</CardTitle>
                <Button variant="outline" onClick={() => setSelectedCase(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedCase.results && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Detection Results</h4>
                      <p><strong>Status:</strong> {selectedCase.results.tumor_detection}</p>
                      <p><strong>Confidence:</strong> {selectedCase.results.tumor_probability}</p>
                      {selectedCase.results.tumor_type && (
                        <p><strong>Type:</strong> {selectedCase.results.tumor_type}</p>
                      )}
                      {selectedCase.results.glioma_grade && selectedCase.results.glioma_grade !== 'N/A' && (
                        <p><strong>Grade:</strong> {selectedCase.results.glioma_grade}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Files</h4>
                      {selectedCase.results.scan_file && (
                        <p><strong>Scan:</strong> {selectedCase.results.scan_file}</p>
                      )}
                      {selectedCase.results.segmentation_file && (
                        <p><strong>Segmentation:</strong> {selectedCase.results.segmentation_file}</p>
                      )}
                    </div>
                  </div>
                  <div className="pt-4 border-t flex gap-2">
                    <Button 
                      onClick={() => downloadResults(selectedCase.case_id)}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Report
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => downloadCaseFolder(selectedCase.case_id)}
                      className="flex items-center gap-2"
                    >
                      <FolderDown className="w-4 h-4" />
                      Download Complete Case
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
