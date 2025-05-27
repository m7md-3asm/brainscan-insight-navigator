
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Download, 
  Eye, 
  Brain,
  Calendar,
  FileText,
  Layers
} from 'lucide-react';

interface HistoricalCase {
  id: string;
  date: string;
  status: 'completed' | 'error';
  tumorDetected: boolean;
  tumorType: string;
  grade?: string;
  confidence: number;
  processingTime: string;
  hasSegmentation: boolean;
}

export const CaseHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cases] = useState<HistoricalCase[]>([
    {
      id: 'CASE_002',
      date: '2024-01-27 14:30',
      status: 'completed',
      tumorDetected: true,
      tumorType: 'Glioma',
      grade: 'Grade II',
      confidence: 0.92,
      processingTime: '4m 32s',
      hasSegmentation: true
    },
    {
      id: 'CASE_001',
      date: '2024-01-27 13:15',
      status: 'completed',
      tumorDetected: true,
      tumorType: 'Meningioma',
      confidence: 0.87,
      processingTime: '3m 45s',
      hasSegmentation: true
    },
    {
      id: 'CASE_003',
      date: '2024-01-26 16:20',
      status: 'completed',
      tumorDetected: false,
      tumorType: 'No Tumor',
      confidence: 0.95,
      processingTime: '2m 18s',
      hasSegmentation: false
    },
    {
      id: 'CASE_004',
      date: '2024-01-26 11:45',
      status: 'completed',
      tumorDetected: true,
      tumorType: 'Pituitary',
      confidence: 0.89,
      processingTime: '3m 52s',
      hasSegmentation: true
    }
  ]);

  const filteredCases = cases.filter(case_ =>
    case_.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    case_.tumorType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTumorBadge = (tumorDetected: boolean, tumorType: string) => {
    if (!tumorDetected) {
      return <Badge variant="outline" className="text-green-600 border-green-600">No Tumor</Badge>;
    }
    
    const colors = {
      'Glioma': 'text-red-600 border-red-600',
      'Meningioma': 'text-orange-600 border-orange-600',
      'Pituitary': 'text-purple-600 border-purple-600'
    };
    
    return (
      <Badge variant="outline" className={colors[tumorType as keyof typeof colors] || 'text-blue-600 border-blue-600'}>
        {tumorType}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Case History</h2>
        <Badge variant="secondary">{cases.length} Total Cases</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search cases by ID or tumor type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {filteredCases.map((case_) => (
          <Card key={case_.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  {case_.id}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {getTumorBadge(case_.tumorDetected, case_.tumorType)}
                  <Badge variant={case_.status === 'completed' ? 'default' : 'destructive'}>
                    {case_.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {case_.date}
                </div>
                <div>Processing: {case_.processingTime}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Detection</p>
                  <p className="font-medium">{case_.tumorDetected ? 'Tumor Present' : 'No Tumor'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-medium">{case_.tumorType}</p>
                </div>
                {case_.grade && (
                  <div>
                    <p className="text-sm text-gray-600">Grade</p>
                    <p className="font-medium">{case_.grade}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Confidence</p>
                  <p className="font-medium">{(case_.confidence * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {case_.hasSegmentation && (
                    <div className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      Segmentation Available
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-1" />
                    Report
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCases.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cases found</h3>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
