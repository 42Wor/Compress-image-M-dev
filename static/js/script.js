document.addEventListener('DOMContentLoaded', () => {
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

    let images = [];  // Store image data (base64, format, filename, size)

     // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

              // Reset quality slider when switching tabs
            if (tabId === 'slider') {
                qualitySlider.value = 75;
                qualityValue.textContent = 75;
           }

            // Show/Hide display property of "size-tab" based on tab
             const sizeTab = document.getElementById('size-tab');
             sizeTab.style.display = tabId === 'size' ? 'flex' : 'none'; // Corrected display logic
        });
    });



    // Update quality value display
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
    });

    fileInput.addEventListener('change', handleFileSelect);

      compressButton.addEventListener('click', () => {
        // Clear previous previews
       // imagePreviewContainer.innerHTML = '';
        // Loop through selected files and compress each
        for (const file of fileInput.files) {
             compressImage(file);
        }
    });



    deleteAllButton.addEventListener('click', deleteAllImages);
    downloadZipButton.addEventListener('click', downloadZip);

     function handleFileSelect(event) {
         const files = event.target.files;
           if (files.length>0) {
             //  compressButton.disabled = false; // Enable compress button
           }
    }

    function compressImage(file) {
         let formData = new FormData();
        formData.append('file', file);
        formData.append('quality', qualitySlider.value);
        formData.append('format', imageFormatSelect.value); //format

        // Get target size based on selected unit
        let targetSize = targetSizeInput.value;
        if(targetSizeInput.value){
            const unit = sizeUnitSelect.value;
            if (unit === 'kb') {
                targetSize = parseFloat(targetSize); // Already in KB
            } else if (unit === 'mb') {
                targetSize = parseFloat(targetSize); // No need to convert here, Python does it.
             }
        }
        formData.append('targetSize', targetSize);



        fetch('/compress', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
              return response.json().then(data => { throw new Error(data.error || 'Network response was not ok')});
            }
           return response.json();
        })
        .then(data => {
            if (data.success) {
                addImagePreview(data.image, data.format, data.filename, data.size);
                images.push({
                    image: data.image,
                    format: data.format,
                    filename: generateUniqueFilename(data.filename, data.format), // Generate unique name
                    size: data.size
                });
                downloadZipButton.style.display = 'block';  // Show download button
            } else {
                console.error('Compression error:', data.error);
                alert(`Compression error: ${data.error}`); // Display error to user
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert(`An error occurred: ${error.message}`); // Display error
        });
    }


    function addImagePreview(imageBase64, format, filename, size) {
        const previewDiv = document.createElement('div');
        previewDiv.classList.add('image-preview');

        const img = document.createElement('img');
        img.src = `data:image/${format};base64,${imageBase64}`;
        previewDiv.appendChild(img);

        const closeButton = document.createElement('button');
        closeButton.classList.add('close-button');
        closeButton.innerHTML = '×'; // Use '×' character
        closeButton.addEventListener('click', () => {
             removeImage(previewDiv, filename); // Pass filename for removal
        });
        previewDiv.appendChild(closeButton);

        const sizeSpan = document.createElement('span'); // Display Size
        sizeSpan.textContent = `New Size: ${(size / 1024).toFixed(2)} KB`; // Convert size
        previewDiv.appendChild(sizeSpan);


        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.classList.add('download-button');
        downloadButton.addEventListener('click', () => {
              downloadSingleImage(imageBase64, generateUniqueFilename(filename, format)); // Use unique filename
        });
        previewDiv.appendChild(downloadButton);

        imagePreviewContainer.appendChild(previewDiv);
    }

     function downloadSingleImage(imageBase64, filename) {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${imageBase64}`; // Corrected MIME type
        link.download = filename;
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
    }

    function removeImage(previewDiv, filename) {
        // Find the index of the image to remove
        const index = images.findIndex(imgData => imgData.filename === filename);
        if (index > -1) {
            images.splice(index, 1); // Remove from the images array
        }
        previewDiv.remove(); // Remove the preview from the DOM

        // If no images left, hide the download button
        if (images.length === 0) {
            downloadZipButton.style.display = 'none';
        }
    }


    function deleteAllImages() {
        images = []; // Clear the images array
        imagePreviewContainer.innerHTML = ''; // Clear all previews
        downloadZipButton.style.display = 'none'; // Hide download button
        fileInput.value = '';  // Clear file input
    }

    function downloadZip() {
        if (images.length === 0) {
            alert('No images to download.');
            return;
        }

        fetch('/download_zip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(images)
        })
        .then(response => {
            if (!response.ok) {
               return response.json().then(data => { throw new Error(data.error || 'Failed to create ZIP.'); });
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'compressed_images.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        })
        .catch(error => {
            console.error('Error downloading ZIP:', error);
             alert(`Error downloading ZIP: ${error.message}`); // Display error
        });
    }
    function generateUniqueFilename(originalFilename, format) {
        const baseName = originalFilename.split('.').slice(0, -1).join('.'); // Remove extension
        const timestamp = Date.now();
        return `${baseName}_${timestamp}.${format.toLowerCase()}`;
    }

});