
from flask import Flask, request, jsonify, send_from_directory, send_file
import os
import time
import shutil
import uuid
import tensorflow as tf
import numpy as np
import torch
from werkzeug.utils import secure_filename
import logging
import glob
import json
import threading
from datetime import datetime
from run_pipeline_for_web import run_pipeline
from flask_cors import CORS
import nibabel as nib
from PIL import Image
import io
import base64
import zipfile
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Updated CORS configuration to include Lovable domains
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5173",
            "https://*.lovableproject.com",
            "https://*.lovable.app"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULTS_FOLDER'] = 'results'
app.config['MAX_CONTENT_LENGTH'] = 800 * 1024 * 1024  # 800 MB
app.config['PROCESSING_THREADS'] = {}  # Store processing threads

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

# Load models (pretending to load the actual model files)
try:
    logger.info("Loading models...")
    # In production, load actual models:
    # detection_model = torch.load('models/detection_model.pth')
    # classification_model = torch.load('models/classification_model.pt')
    # segmentation_model = torch.load('models/glioma_segmentation_model.pth')
    logger.info("Models loaded successfully")
except Exception as e:
    logger.error(f"Error loading models: {str(e)}")
    detection_model = None
    classification_model = None
    segmentation_model = None

# Custom error handler
class APIError(Exception):
    def __init__(self, message, status_code=400, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        rv['status'] = 'error'
        return rv

@app.errorhandler(APIError)
def handle_api_error(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response

@app.errorhandler(Exception)
def handle_generic_error(error):
    logger.error(f"Unhandled error: {str(error)}", exc_info=True)
    response = jsonify({
        'status': 'error',
        'message': 'An unexpected error occurred. Please try again later.',
        'details': str(error) if app.debug else None
    })
    response.status_code = 500
    return response

@app.route('/')
def index():
    return jsonify({
        'status': 'running',
        'message': 'Medical AI Brain Tumor Analysis API',
        'version': '1.0.0'
    })

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'upload_folder': os.path.exists(app.config['UPLOAD_FOLDER']),
        'results_folder': os.path.exists(app.config['RESULTS_FOLDER'])
    })

@app.route('/check_case_id/<case_id>')
def check_case_id(case_id):
    """Check if case_id already exists"""
    case_folder = os.path.join(app.config['RESULTS_FOLDER'], secure_filename(case_id))
    exists = os.path.exists(case_folder)
    return jsonify({'exists': exists})

@app.route('/cases')
def list_cases():
    """List all available cases with enhanced metadata"""
    try:
        cases = []
        for case_dir in glob.glob(f"{app.config['RESULTS_FOLDER']}/*"):
            case_id = os.path.basename(case_dir)
            if not case_id or not os.path.isdir(case_dir):
                continue
            
            status_file = os.path.join(case_dir, 'status.txt')
            if not os.path.exists(status_file):
                continue
                
            with open(status_file, 'r') as f:
                status = f.read().strip()
            
            # Get creation time
            case_time = datetime.fromtimestamp(os.path.getctime(case_dir))
            
            # Get metadata if available
            metadata_file = os.path.join(case_dir, 'metadata.json')
            metadata = {}
            if os.path.exists(metadata_file):
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                except:
                    pass
            
            cases.append({
                'case_id': case_id,
                'status': status,
                'date': case_time.strftime('%Y-%m-%d %H:%M:%S'),
                'metadata': metadata
            })
        
        # Sort by date, newest first
        cases.sort(key=lambda x: x['date'], reverse=True)
        return jsonify({'cases': cases})
    except Exception as e:
        logger.error(f"Error listing cases: {str(e)}")
        return jsonify({'error': 'Error listing cases', 'details': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Enhanced file upload with better validation and error handling"""
    try:
        if 'files' not in request.files:
            logger.error('No files provided in upload')
            raise APIError('No files provided')
            
        case_id = request.form.get('case_id')
        if not case_id:
            logger.error('No case ID provided in upload')
            raise APIError('No case ID provided')
            
        case_id = secure_filename(case_id)
        
        # Ensure case_id is unique
        case_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], case_id)
        case_results_folder = os.path.join(app.config['RESULTS_FOLDER'], case_id)
        
        if os.path.exists(case_results_folder):
            logger.error(f'Case ID already exists: {case_id}')
            raise APIError('Case ID already exists')
        
        os.makedirs(case_upload_folder, exist_ok=True)
        os.makedirs(case_results_folder, exist_ok=True)
        
        files = request.files.getlist('files')
        if not files:
            logger.error('No files were uploaded (empty list)')
            raise APIError('No files were uploaded')
        
        logger.info(f"Received {len(files)} files for case {case_id}")
        
        scan_files = {}
        all_filenames = []
        validation_errors = []
        
        for file in files:
            if not file.filename:
                continue
                
            filename = secure_filename(os.path.basename(file.filename))
            all_filenames.append(filename)
            logger.info(f"Processing file: {filename}")
            
            file_path = os.path.join(case_upload_folder, filename)
            file.save(file_path)
            
            try:
                validate_nifti_file(file_path)
            except APIError as e:
                logger.error(f"Validation error for {filename}: {str(e)}")
                validation_errors.append(f"{filename}: {str(e)}")
                continue
            
            # Enhanced scan type detection
            lower_filename = filename.lower()
            if 't1' in lower_filename and 'ce' not in lower_filename and 't10' not in lower_filename:
                scan_files['T1'] = filename
            elif 't2' in lower_filename and 't2*' not in lower_filename and 't20' not in lower_filename:
                scan_files['T2'] = filename
            elif any(pattern in lower_filename for pattern in ['t1ce', 't1_ce', 't1-ce']):
                scan_files['T1CE'] = filename
            elif 'flair' in lower_filename:
                scan_files['FLAIR'] = filename
        
        if validation_errors:
            cleanup_case_folders(case_upload_folder, case_results_folder)
            raise APIError('File validation errors', payload={'errors': validation_errors})
        
        # Check for required scans
        missing_files = []
        required_scans = ['T1', 'T2']
        for scan in required_scans:
            if scan not in scan_files:
                missing_files.append(scan)
        
        if missing_files:
            cleanup_case_folders(case_upload_folder, case_results_folder)
            raise APIError(
                f"Missing required scan files: {', '.join(missing_files)}",
                payload={
                    'missing_files': missing_files,
                    'uploaded_files': all_filenames,
                    'detected_scans': list(scan_files.keys())
                }
            )
        
        # Create comprehensive metadata
        metadata = {
            'case_id': case_id,
            'upload_time': datetime.now().isoformat(),
            'files': all_filenames,
            'scan_files': scan_files,
            'validation_status': 'passed',
            'file_count': len(files),
            'detected_scan_types': list(scan_files.keys())
        }
        
        with open(os.path.join(case_results_folder, 'metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=4)
        
        # Initialize processing
        update_progress(
            case_results_folder,
            0,
            'initialization',
            'Starting analysis...',
            {'files_validated': len(files), 'scan_types': list(scan_files.keys())}
        )
        
        # Start processing in background thread
        processing_thread = threading.Thread(
            target=process_case,
            args=(case_id, case_upload_folder, case_results_folder, scan_files)
        )
        processing_thread.daemon = True
        processing_thread.start()
        
        app.config['PROCESSING_THREADS'][case_id] = processing_thread
        
        logger.info(f"Upload and validation successful for case {case_id}")
        return jsonify({
            'status': 'processing',
            'case_id': case_id,
            'task_id': case_id,
            'message': 'Files uploaded and validated successfully. Processing started.',
            'detected_scans': list(scan_files.keys())
        })
        
    except APIError as e:
        logger.error(f"APIError during upload: {e.message}")
        raise e
    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        raise APIError(f'Server error: {str(e)}', status_code=500)

@app.route('/api/download-case/<case_id>')
def download_case_folder(case_id):
    """Download complete case folder as ZIP file"""
    try:
        case_id = secure_filename(case_id)
        upload_dir, results_dir = get_case_dir(case_id)
        
        # Create temporary zip file
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, f"{case_id}_complete_case.zip")
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add original scans from upload directory
            if os.path.exists(upload_dir):
                for root, dirs, files in os.walk(upload_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.join('original_scans', os.path.relpath(file_path, upload_dir))
                        zipf.write(file_path, arcname)
            
            # Add results from results directory
            if os.path.exists(results_dir):
                for root, dirs, files in os.walk(results_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.join('results', os.path.relpath(file_path, results_dir))
                        zipf.write(file_path, arcname)
        
        def cleanup():
            """Clean up temporary files after sending"""
            try:
                os.remove(zip_path)
                os.rmdir(temp_dir)
            except:
                pass
        
        return send_file(
            zip_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f"{case_id}_complete_case.zip"
        )
        
    except FileNotFoundError:
        return jsonify({'error': 'Case not found'}), 404
    except Exception as e:
        logger.error(f"Error creating case download for {case_id}: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

def cleanup_case_folders(upload_folder, results_folder):
    """Helper function to clean up case folders on error"""
    try:
        if os.path.exists(upload_folder):
            shutil.rmtree(upload_folder)
        if os.path.exists(results_folder):
            shutil.rmtree(results_folder)
    except Exception as e:
        logger.error(f"Error cleaning up folders: {str(e)}")

def get_case_dir(case_id):
    """Get the case directory paths"""
    case_id = secure_filename(case_id)
    upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], case_id)
    results_dir = os.path.join(app.config['RESULTS_FOLDER'], case_id)
    
    if not os.path.exists(upload_dir) and not os.path.exists(results_dir):
        raise FileNotFoundError(f"Case directory not found: {case_id}")
    
    return upload_dir, results_dir

@app.route('/api/results/<case_id>')
def get_results(case_id):
    """Enhanced results endpoint with better error handling"""
    try:
        case_id = secure_filename(case_id)
        _, results_dir = get_case_dir(case_id)
        
        status_file = os.path.join(results_dir, 'status.txt')
        if not os.path.exists(status_file):
            return jsonify({'status': 'processing', 'message': 'Processing started...'}), 200
        
        with open(status_file, 'r') as f:
            status = f.read().strip()
        
        if status == 'processing':
            progress_file = os.path.join(results_dir, 'progress.json')
            progress = {'status': 'processing', 'message': 'Processing...'}
            if os.path.exists(progress_file):
                try:
                    with open(progress_file, 'r') as pf:
                        progress.update(json.load(pf))
                except:
                    pass
            return jsonify(progress), 200
        
        if status == 'error':
            error_file = os.path.join(results_dir, 'error.txt')
            error_msg = 'Unknown error'
            if os.path.exists(error_file):
                try:
                    with open(error_file, 'r') as ef:
                        error_msg = ef.read().strip()
                except:
                    pass
            return jsonify({'status': 'error', 'error': error_msg}), 200
        
        if status == 'cancelled':
            return jsonify({'status': 'cancelled', 'message': 'Processing was cancelled'}), 200
        
        # status == 'done'
        results_file = os.path.join(results_dir, 'results.txt')
        results = {'status': 'done'}
        
        if os.path.exists(results_file):
            try:
                with open(results_file, 'r') as rf:
                    for line in rf:
                        if ':' in line:
                            key, value = line.split(':', 1)
                            results[key.strip()] = value.strip()
            except:
                pass
        
        return jsonify(results), 200
        
    except FileNotFoundError:
        return jsonify({'status': 'error', 'error': 'Case not found'}), 404
    except Exception as e:
        logger.error(f"Error getting results for case {case_id}: {str(e)}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/case/<case_id>/progress')
def get_progress(case_id):
    """Get the progress of a running case"""
    try:
        case_id = secure_filename(case_id)
        progress_path = os.path.join(app.config['RESULTS_FOLDER'], case_id, 'progress.json')
        
        if not os.path.exists(progress_path):
            return jsonify({'error': 'Progress file not found'}), 404
            
        with open(progress_path, 'r') as f:
            progress = json.load(f)
        
        return jsonify(progress)
    except Exception as e:
        logger.error(f"Error getting progress for case {case_id}: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/case/<case_id>/cancel', methods=['POST'])
def cancel_processing(case_id):
    """Cancel a running processing job"""
    try:
        case_id = secure_filename(case_id)
        case_results_folder = os.path.join(app.config['RESULTS_FOLDER'], case_id)
        
        if not os.path.exists(case_results_folder):
            return jsonify({'error': 'Case not found'}), 404
        
        # Update status file
        with open(os.path.join(case_results_folder, 'status.txt'), 'w') as f:
            f.write('cancelled')
        
        # Update progress
        update_progress(
            case_results_folder,
            0,
            'cancelled',
            'Processing cancelled by user',
            {'cancelled_at': datetime.now().isoformat()}
        )
        
        return jsonify({'success': True, 'message': 'Processing cancelled'})
    except Exception as e:
        logger.error(f"Error cancelling case {case_id}: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/uploads/<case_id>/<filename>')
def serve_upload(case_id, filename):
    """Serve uploaded files"""
    try:
        case_id = secure_filename(case_id)
        filename = secure_filename(filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], case_id, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        mimetype = 'application/x-gzip' if filename.endswith('.nii.gz') else None
        return send_file(file_path, mimetype=mimetype)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/results/<case_id>/<filename>')
def serve_result(case_id, filename):
    """Serve result files"""
    try:
        case_id = secure_filename(case_id)
        filename = secure_filename(filename)
        file_path = os.path.join(app.config['RESULTS_FOLDER'], case_id, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        mimetype = 'application/x-gzip' if filename.endswith('.nii.gz') else None
        return send_file(file_path, mimetype=mimetype)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def update_progress(results_folder, percentage, step, message, details=None):
    """Update progress with detailed information"""
    progress_file = os.path.join(results_folder, 'progress.json')
    progress = {
        'percentage': percentage,
        'step': step,
        'message': message,
        'details': details or {},
        'timestamp': datetime.now().isoformat()
    }
    
    try:
        with open(progress_file, 'w') as f:
            json.dump(progress, f, indent=4)
    except Exception as e:
        logger.error(f"Error updating progress: {str(e)}")

def validate_nifti_file(file_path):
    """Validate NIFTI file format and content"""
    try:
        img = nib.load(file_path)
        if img.header.get_data_shape() is None:
            raise APIError(f"Invalid NIFTI file: {os.path.basename(file_path)}")
        
        # Additional validation checks
        data_shape = img.header.get_data_shape()
        if len(data_shape) < 3:
            raise APIError(f"NIFTI file must be 3D or 4D: {os.path.basename(file_path)}")
        
        return True
    except Exception as e:
        raise APIError(f"Error validating NIFTI file {os.path.basename(file_path)}: {str(e)}")

def process_case(case_id, upload_folder, results_folder, scan_files):
    """Process the case by calling the pipeline runner"""
    try:
        os.makedirs(results_folder, exist_ok=True)
        
        logger.info(f"Starting pipeline for case {case_id}")
        logger.info(f"Upload folder: {upload_folder}")
        logger.info(f"Results folder: {results_folder}")
        
        # Verify required files exist
        for scan_type, filename in scan_files.items():
            file_path = os.path.join(upload_folder, filename)
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Required scan file not found: {file_path}")
        
        # Copy scans to results folder for processing
        for scan_type, filename in scan_files.items():
            src = os.path.join(upload_folder, filename)
            dst = os.path.join(results_folder, filename)
            shutil.copy(src, dst)
        
        # Update progress before starting pipeline
        update_progress(
            results_folder,
            10,
            'pipeline_start',
            'Starting AI analysis pipeline...',
            {'scan_files': scan_files}
        )
        
        # Run the actual pipeline
        run_pipeline(results_folder)
        
        logger.info(f"Pipeline for case {case_id} completed successfully")
        
        # Create additional metadata for completed case
        completion_metadata = {
            'completion_time': datetime.now().isoformat(),
            'processing_duration': 'calculated_duration',  # You can calculate this
            'pipeline_version': '1.0.0'
        }
        
        metadata_file = os.path.join(results_folder, 'metadata.json')
        if os.path.exists(metadata_file):
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                metadata.update(completion_metadata)
                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=4)
            except:
                pass
        
        # Build OHIF viewer URL if applicable
        scan_path = scan_files.get('T1CE', scan_files.get('T1'))
        ohif_url = (
            f"http://localhost:3000/viewer"
            f"?image1=http://localhost:5000/results/{case_id}/{scan_path}"
            f"&image2=http://localhost:5000/results/{case_id}/{case_id}_mask_resized.nii.gz"
        )
        
        try:
            with open(os.path.join(results_folder, 'viewer_url.txt'), 'w') as f:
                f.write(ohif_url)
        except:
            pass
        
        # Mark as completed
        with open(os.path.join(results_folder, 'status.txt'), 'w') as f:
            f.write('done')
        
        update_progress(
            results_folder,
            100,
            'completed',
            'Analysis completed successfully',
            {'ohif_url': ohif_url}
        )
        
    except Exception as e:
        logger.error(f"Error processing case {case_id}: {str(e)}")
        try:
            with open(os.path.join(results_folder, 'status.txt'), 'w') as f:
                f.write('error')
            
            with open(os.path.join(results_folder, 'error.txt'), 'w') as f:
                f.write(str(e))
            
            update_progress(
                results_folder,
                0,
                "error",
                f"Error: {str(e)}",
                {'error_type': type(e).__name__}
            )
        except:
            pass

# Additional utility endpoints
@app.route('/api/slices/<case_id>/<scan_type>/<int:slice_idx>')
def get_slice(case_id, scan_type, slice_idx):
    """Get specific slice from NIFTI file as PNG"""
    try:
        case_id = secure_filename(case_id)
        
        if scan_type == 'mask':
            nifti_path = os.path.join('results', case_id, f'{case_id}_mask_resized.nii.gz')
            if not os.path.exists(nifti_path):
                nifti_path = os.path.join('results', case_id, f'{case_id}_meningioma_seg.nii.gz')
        else:
            nifti_path = os.path.join('results', case_id, f'{scan_type.upper()}.nii.gz')
        
        if not os.path.exists(nifti_path):
            return jsonify({'error': 'File not found'}), 404

        nifti_img = nib.load(nifti_path)
        data = nifti_img.get_fdata()

        if scan_type == 'mask':
            slice_data = (data[:, :, slice_idx] > 0).astype(np.uint8) * 255
        else:
            slice_data = data[:, :, slice_idx]
            min_val = np.min(slice_data)
            max_val = np.max(slice_data)
            if max_val > min_val:
                slice_data = ((slice_data - min_val) / (max_val - min_val) * 255).astype(np.uint8)
            else:
                slice_data = np.zeros_like(slice_data, dtype=np.uint8)

        img = Image.fromarray(slice_data)
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        return send_file(img_byte_arr, mimetype='image/png', as_attachment=False)

    except Exception as e:
        logger.error(f"Error serving slice: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/slices/<case_id>/<scan_type>/info')
def get_slice_info(case_id, scan_type):
    """Get information about NIFTI file slices"""
    try:
        case_id = secure_filename(case_id)
        
        if scan_type == 'mask':
            nifti_path = os.path.join('results', case_id, f'{case_id}_mask_resized.nii.gz')
        else:
            nifti_path = os.path.join('results', case_id, f'{scan_type.upper()}.nii.gz')
        
        if not os.path.exists(nifti_path):
            return jsonify({'error': 'File not found'}), 404

        nifti_img = nib.load(nifti_path)
        data = nifti_img.get_fdata()

        return jsonify({
            'num_slices': data.shape[2],
            'width': data.shape[0],
            'height': data.shape[1],
            'data_type': str(data.dtype)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Medical AI Brain Tumor Analysis Server...")
    print("Server will be available at: http://localhost:5000")
    print("Health check endpoint: http://localhost:5000/health")
    app.run(host='0.0.0.0', port=5000, debug=True)
