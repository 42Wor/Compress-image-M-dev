from flask import Flask, request, render_template, send_file, flash, jsonify
from PIL import Image
import io
import os
import secrets
import logging
import mimetypes
import zipfile

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def detect_image_format(image_file):
    try:
        image_file.seek(0)
        mime_type, _ = mimetypes.guess_type(image_file.filename)
        if mime_type:
            return mime_type.split('/')[-1].upper()  # e.g., 'JPEG', 'PNG'
        image_file.seek(0)
        img = Image.open(image_file)
        return img.format
    except Exception as e:
        logging.error(f"Error detecting format: {e}")
        return None

def compress_image(image_file, quality=75, output_format=None, target_size=None):
    """Compresses an image with quality, format, and optional target size."""
    try:
        img = Image.open(image_file)
        original_format = img.format

        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        if output_format is None or output_format.lower() == "auto":
            output_format = original_format or "JPEG"
        output_format = output_format.upper()

        # Target size compression (iterative quality adjustment)
        if target_size:
            quality = 95  # Start high
            while True:
                img_io = io.BytesIO()
                img.save(img_io, format=output_format, quality=quality, optimize=True)
                img_io.seek(0)
                file_size = img_io.getbuffer().nbytes
                logging.info(f"Current size: {file_size}, Target: {target_size}, Quality: {quality}")
                if file_size <= target_size or quality <= 5:  # Stop if small enough or quality too low
                    break
                quality -= 5  # Reduce quality
            return img_io, output_format, file_size
        else:
            # Regular quality-based compression
            img_io = io.BytesIO()
            img.save(img_io, format=output_format, quality=quality, optimize=True)
            img_io.seek(0)
            file_size = img_io.getbuffer().nbytes
            return img_io, output_format, file_size

    except Exception as e:
        logging.error(f"Compression error: {e}")
        return None, None, None



@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')


@app.route('/compress', methods=['POST'])
def compress():
    """Handles the AJAX compression request."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    quality = int(request.form.get('quality', 75))
    output_format = request.form.get('format', 'auto')
    target_size_str = request.form.get('targetSize', None)  # Get target size as string
    target_size = None
    if target_size_str:
        try:
             target_size = int(float(target_size_str) * 1024 * 1024)  # Convert MB to bytes

        except ValueError:
            return jsonify({'error': "Invalid target size"}), 400

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        detected_format = detect_image_format(file)
        if output_format.lower() == "auto" and detected_format:
             output_format = detected_format

        try:
            compressed_img, actual_format, final_size = compress_image(file, quality, output_format, target_size)
            if compressed_img:
                # Convert the image to base64 for sending to the frontend
                import base64
                image_base64 = base64.b64encode(compressed_img.getvalue()).decode('utf-8')

                return jsonify({
                    'success': True,
                    'image': image_base64,
                    'format': actual_format.lower(),
                    'size': final_size,
                    'filename': file.filename
                })
            else:
                return jsonify({'error': 'Compression failed'}), 500
        except Exception as e:
            logging.exception(f"Error: {e}") # Log full traceback
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Invalid file type'}), 400

@app.route('/download_zip', methods=['POST'])
def download_zip():
    """Handles the ZIP download request."""
    images_data = request.get_json()
    if not images_data:
        return jsonify({'error': 'No images provided'}), 400

    zip_io = io.BytesIO()  # In-memory ZIP file
    with zipfile.ZipFile(zip_io, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for image_data in images_data:
            try:
                # Decode the base64 image
                image_bytes = base64.b64decode(image_data['image'])
                filename = image_data['filename']
                # Add the image to the ZIP file
                zipf.writestr(filename, image_bytes)
            except Exception as e:
                logging.error(f"Error adding image to ZIP: {e}")
                #  Consider returning a partial ZIP or an error message
                return jsonify({'error': f'Error creating ZIP: {e}'}), 500


    zip_io.seek(0)
    return send_file(zip_io, mimetype='application/zip', download_name='compressed_images.zip', as_attachment=True)

if __name__ == '__main__':
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
    app.run(debug=True) # VERY IMPORTANT: Set debug=False in production!