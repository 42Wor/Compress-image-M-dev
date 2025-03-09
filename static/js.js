document.addEventListener('DOMContentLoaded', function () {
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');
    const imageComparisonView = document.getElementById('image-comparison-view');
    const originalImagePreviewDiv = document.getElementById('original-image-preview');
    const originalUploadedImage = document.getElementById('original-uploaded-image');
    const originalImageSizeDisplay = document.getElementById('original-image-size');
    const newImagePreviewDiv = document.getElementById('new-image-preview');
    const newUploadedImage = document.getElementById('new-uploaded-image');
    const newImageSizeDisplay = document.getElementById('new-image-size');
    const downloadButton = document.getElementById('download-button');
    const errorMessageDisplay = document.getElementById('error-message');
    const loadingOverlay = document.getElementById('loading-overlay');

    uploadButton.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        errorMessageDisplay.textContent = '';
        const file = fileInput.files[0];

        if (file) {
            const fileSizeInBytes = file.size;
            const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
            const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

            let displaySize = fileSizeInKB + " KB";
            if (fileSizeInKB > 1000) {
                displaySize = fileSizeInMB + " MB";
            }

            const formData = new FormData();
            formData.append('image', file);

            loadingOverlay.style.display = 'flex';
            uploadButton.style.display = 'none';

            fetch('/', {
                method: 'POST',
                body: formData,
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                loadingOverlay.style.display = 'none';

                if (data.compressed_image_url) {
                    originalUploadedImage.src = URL.createObjectURL(file);
                    newUploadedImage.src = data.compressed_image_url;
                    downloadButton.href = data.compressed_image_url;

                    originalImagePreviewDiv.style.display = 'block';
                    originalImageSizeDisplay.textContent = "Original Size: " + displaySize;
                    originalImageSizeDisplay.style.display = 'block';

                    const newSizeKB = data.compressed_image_size_kb;
                    let newDisplaySize = newSizeKB + " KB";
                    if (newSizeKB > 1000) {
                        newDisplaySize = (newSizeKB / 1024).toFixed(2) + " MB";
                    }
                    newImageSizeDisplay.textContent = "New Size: " + newDisplaySize;
                    newImageSizeDisplay.style.display = 'block';

                    imageComparisonView.style.display = 'flex';
                    downloadButton.style.display = 'block';

                    history.pushState({uiState: 'results'}, '', null);

                } else if (data.error) {
                    errorMessageDisplay.textContent = "Error from server: " + data.error;
                    imageComparisonView.style.display = 'none';
                    downloadButton.style.display = 'none';
                    uploadButton.style.display = 'block';
                } else {
                    errorMessageDisplay.textContent = "Unknown error during upload.";
                    imageComparisonView.style.display = 'none';
                    downloadButton.style.display = 'none';
                    uploadButton.style.display = 'block';
                }
            })
            .catch(error => {
                loadingOverlay.style.display = 'none';
                errorMessageDisplay.textContent = 'Error during upload: ' + error.message;
                imageComparisonView.style.display = 'none';
                downloadButton.style.display = 'none';
                uploadButton.style.display = 'block';
                console.error('Upload error:', error);
            });


        } else {
            errorMessageDisplay.textContent = 'No file selected.';
            imageComparisonView.style.display = 'none';
            uploadButton.style.display = 'block';
        }
    });

    window.addEventListener('popstate', function(event) {
        if (event.state === null || event.state.uiState === 'results') {
            imageComparisonView.style.display = 'none';
            downloadButton.style.display = 'none';
            uploadButton.style.display = 'block';
            errorMessageDisplay.textContent = '';
            originalImagePreviewDiv.style.display = 'none';
            newImagePreviewDiv.style.display = 'none';
            originalImageSizeDisplay.style.display = 'none';
            newImageSizeDisplay.style.display = 'none';
            fileInput.value = '';
        }
    });
});