from flask import Flask, request, send_file, render_template, jsonify, url_for
from PIL import Image
import io
import os

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
COMPRESSED_FOLDER = 'compressed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['COMPRESSED_FOLDER'] = COMPRESSED_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COMPRESSED_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET', 'POST'])
def index():
    error_message = None
    compressed_image_url = None
    compressed_image_size_kb = None # Initialize compressed image size

    if request.method == 'POST':
        if 'image' not in request.files:
            error_message = 'No file part'
        file = request.files['image']
        if file.filename == '':
            error_message = 'No selected file'
        if file and allowed_file(file.filename):
            filename = file.filename
            upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(upload_path)

            compressed_image_path = compress_image(upload_path, app.config['COMPRESSED_FOLDER'], filename)

            if compressed_image_path:
                compressed_filename = os.path.basename(compressed_image_path)
                compressed_image_url = url_for('download_image', filename=compressed_filename)

                # Calculate compressed image size in KB
                compressed_image_size_bytes = os.path.getsize(compressed_image_path)
                compressed_image_size_kb = round(compressed_image_size_bytes / 1024, 2) # Rounded to 2 decimal places
            else:
                error_message = 'Image compression failed'
        else:
            error_message = 'Invalid file type. Allowed types are: ' + ', '.join(ALLOWED_EXTENSIONS)

    if error_message:
        return jsonify({'error': error_message})
    elif compressed_image_url:
        return jsonify({
            'compressed_image_url': compressed_image_url,
            'compressed_image_size_kb': compressed_image_size_kb # Include size in JSON response
        })
    else:
        delete_images()
        return render_template('index.html')

def compress_image(image_path, output_folder, filename):
    try:
        img = Image.open(image_path)
        compressed_filename = f"compressed_{filename}"
        compressed_image_path = os.path.join(output_folder, compressed_filename)

        if filename.lower().endswith(('.jpg', '.jpeg')):
            img.save(compressed_image_path, optimize=True, quality=85)
        elif filename.lower().endswith('.png'):
            img.save(compressed_image_path, optimize=True)
        elif filename.lower().endswith('.gif'):
            img.save(compressed_image_path, optimize=True)
        elif filename.lower().endswith('.webp'):
            img.save(compressed_image_path, quality=80, lossless=False)
        else:
            img.save(compressed_image_path, optimize=True)

        return compressed_image_path

    except Exception as e:
        print(f"Error during image compression: {e}")
        return None

@app.route('/download/<filename>')
def download_image(filename):
    compressed_folder = app.config['COMPRESSED_FOLDER']
    compressed_file_path = os.path.join(compressed_folder, filename)
    if os.path.exists(compressed_file_path):
        return send_file(compressed_file_path, as_attachment=True)
    else:
        return "File not found.", 404

def delete_images():
        for folder in [app.config['UPLOAD_FOLDER'], app.config['COMPRESSED_FOLDER']]:
            for filename in os.listdir(folder):
                file_path = os.path.join(folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)

if __name__ == '__main__':
    app.run(debug=True)