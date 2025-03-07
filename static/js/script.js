document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const fileInput = document.getElementById('file-input');
    const compressButton = document.getElementById('compress-button');
    const deleteAllButton = document.getElementById('delete-all-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const downloadZipButton = document.getElementById('download-zip-button');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const targetSizeInput = document.getElementById('target-size');
    const sizeUnitSelect = document.getElementById('size-unit');
    const imageFormatSelect = document.getElementById('image-format');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- State ---
    let images = [];  // Store image data: { base64, format, filename, originalSize, compressedSize }

    // --- Utility Functions ---

    function generateUniqueFilename(originalFilename, format) {
        const baseName = originalFilename.split('.').slice(0, -1).join('.');
        const timestamp = Date.now();
        return `${baseName}_${timestamp}.${format.toLowerCase()}`;
    }

    function updateButtonStates() {
        compressButton.disabled = fileInput.files.length === 0; // Disable if no files selected
        deleteAllButton.disabled = images.length === 0;
        downloadZipButton.style.display = images.length > 0 ? 'block' : 'none';
    }


    // --- Event Handlers ---

    // Tab Switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Reset quality slider when switching tabs (and show/hide size-tab)
            if (tabId === 'slider') {
                qualitySlider.value = 75;
                qualityValue.textContent = 75;
            }

            const sizeTab = document.getElementById('size-tab');
            sizeTab.style.display = tabId === 'size' ? 'flex' : 'none';
        });
    });

    // Update Quality Value Display
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
    });

    // File Input Change
    fileInput.addEventListener('change', () => {
        updateButtonStates();
    });

    // Compress Button Click
    compressButton.addEventListener('click', () => {
      for (const file of fileInput.files) {
        compressImage(file);
      }
    });

    // Delete All Button Click
    deleteAllButton.addEventListener('click', deleteAllImages);

    // Download Zip Button Click
    downloadZipButton.addEventListener('click', downloadZip);



    // --- Core Functions ---

    async function compressImage(file) {
        try {
            if (!file.type.startsWith('image/')) {
                throw new Error('Selected file is not an image.'); // Validate file type
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('quality', qualitySlider.value);
            formData.append('format', imageFormatSelect.value);

            let targetSize = null;
             if (targetSizeInput.value) {
               targetSize = parseFloat(targetSizeInput.value);
                const unit = sizeUnitSelect.value;
                if (unit === 'kb') {
                    targetSize *= 1024; // Convert KB to bytes
                } else if (unit === 'mb') {
                    targetSize *= 1024 * 1024; // Convert MB to bytes
                }
             }

            formData.append('targetSize', targetSize || ''); // Send empty string if null

            const response = await fetch('/compress', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Network response was not ok');
            }

            const data = await response.json();

            if (data.success) {
                addImagePreview(data.image, data.format, data.filename, data.size, file.size); //Pass original size
                images.push({
                    image: data.image,
                    format: data.format,
                    filename: generateUniqueFilename(data.filename, data.format),
                    originalSize: file.size,  // Store original size
                    compressedSize: data.size
                });
                updateButtonStates();
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            console.error('Error:', error);
            alert(`An error occurred: ${error.message}`);
        }
    }
   function addImagePreview(imageBase64, format, filename, compressedSize, originalSize) {
        const previewDiv = document.createElement('div');
        previewDiv.classList.add('image-preview');

        const img = document.createElement('img');
        img.src = `data:image/${format};base64,${imageBase64}`;
        previewDiv.appendChild(img);

        const closeButton = document.createElement('button');
        closeButton.classList.add('close-button');
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => removeImage(previewDiv, filename));
        previewDiv.appendChild(closeButton);

        // Display BOTH Original and New Sizes
        const sizeInfo = document.createElement('div');
        sizeInfo.innerHTML = `
            Original Size: ${(originalSize / 1024).toFixed(2)} KB<br>
            New Size: ${(compressedSize / 1024).toFixed(2)} KB
        `;
        previewDiv.appendChild(sizeInfo);


        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.classList.add('download-button');
        downloadButton.addEventListener('click', () => downloadSingleImage(imageBase64, generateUniqueFilename(filename, format)));
        previewDiv.appendChild(downloadButton);

        imagePreviewContainer.appendChild(previewDiv);
    }



    function downloadSingleImage(imageBase64, filename) {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${imageBase64}`;  //MIME type should be dynamic
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function removeImage(previewDiv, filename) {
        images = images.filter(imgData => imgData.filename !== filename);
        previewDiv.remove();
        updateButtonStates();
    }

    function deleteAllImages() {
        images = [];
        imagePreviewContainer.innerHTML = '';
        fileInput.value = ''; // Clear the file input
        updateButtonStates();
    }


    async function downloadZip() {
        if (images.length === 0) {
            alert('No images to download.');
            return;
        }

        try {
            const response = await fetch('/download_zip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(images)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create ZIP.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'compressed_images.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

        } catch (error) {
            console.error('Error downloading ZIP:', error);
            alert(`Error downloading ZIP: ${error.message}`);
        }
    }
});