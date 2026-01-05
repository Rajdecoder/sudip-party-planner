// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCDuau7j4CyfotHfMr0svnDY8hp10F3f3M",
  authDomain: "sudipparty-24d31.firebaseapp.com",
  projectId: "sudipparty-24d31",
  storageBucket: "sudipparty-24d31.firebasestorage.app",
  messagingSenderId: "372149822854",
  appId: "1:372149822854:web:ca02d0536a604a31703807"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- 1. Star Rating Logic (UI) ---
const stars = document.querySelectorAll('#starRatingInput i');
const ratingValue = document.getElementById('selectedRating');

if(stars.length > 0) {
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = star.getAttribute('data-value');
            ratingValue.value = val;
            
            stars.forEach(s => {
                s.style.color = (s.getAttribute('data-value') <= val) ? "#ffc107" : "#ccc";
            });
        });
    });
    // Set default visual to 5 stars
    stars.forEach(s => s.style.color = "#ffc107");
}

// --- 2. Navigation Menu Logic ---
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav-links');
const navLinks = document.querySelectorAll('.nav-links li');

if(burger) {
    burger.addEventListener('click', () => {
        nav.classList.toggle('nav-active');
        burger.classList.toggle('toggle');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('nav-active');
            burger.classList.remove('toggle');
        });
    });
}

// --- 3. Image Compression Logic ---
async function compressImage(file) {
    if (file.type.startsWith('video/')) return file;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
            }
        }
    });
}

// --- 4. PREVIEW LOGIC ---
const fileInput = document.getElementById('reviewMedia');
const previewContainer = document.getElementById('previewContainer');
const fileNameDisplay = document.getElementById('fileName');
const imagePreview = document.getElementById('imagePreview');
const videoPreview = document.getElementById('videoPreview');
const uploadBtnText = document.getElementById('uploadBtnText');

if(fileInput) {
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            previewContainer.style.display = 'block';
            if(fileNameDisplay) fileNameDisplay.textContent = "Selected: " + file.name;
            if(uploadBtnText) uploadBtnText.textContent = "Change File";
            
            imagePreview.style.display = 'none';
            videoPreview.style.display = 'none';

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'inline-block';
                }
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                videoPreview.src = URL.createObjectURL(file);
                videoPreview.style.display = 'block';
            }
        } else {
            previewContainer.style.display = 'none';
        }
    });
}

// --- 5. Review Submission Logic ---
const reviewForm = document.getElementById('reviewForm');
const submitBtn = document.getElementById('submitBtn');
const uploadStatus = document.getElementById('uploadStatus');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

if(reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";

        const name = document.getElementById('reviewerName').value;
        const text = document.getElementById('reviewerText').value;
        const rating = parseInt(document.getElementById('selectedRating').value);
        const file = fileInput.files[0];
        let downloadURL = null;
        let fileType = null;

        try {
            if (file) {
                uploadStatus.style.display = 'block';
                statusText.innerText = "Compressing & Uploading...";
                const compressedFile = await compressImage(file);
                fileType = file.type.startsWith('video/') ? 'video' : 'image';
                
                const storageRef = ref(storage, 'reviews/' + Date.now() + '-' + file.name);
                const uploadTask = uploadBytesResumable(storageRef, compressedFile);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            progressBar.style.width = progress + '%';
                        }, 
                        (error) => reject(error), 
                        () => {
                            getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                                downloadURL = url;
                                resolve();
                            });
                        }
                    );
                });
            }

            await addDoc(collection(db, "reviews"), {
                name: name,
                text: text,
                rating: rating,
                mediaURL: downloadURL,
                mediaType: fileType,
                createdAt: serverTimestamp()
            });

            alert("Review Submitted Successfully!"); 
            window.location.reload(); 

        } catch (error) {
            console.error("Error:", error);
            alert("Error: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Post Review";
        }
    });
}

// --- 6. Load Reviews (WITH FRAME FIX) ---
const reviewsContainer = document.getElementById('reviewsContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
let lastVisible = null;
const BATCH_SIZE = 5; 

// --- UPDATED REVIEW MANAGEMENT (Shows Photos/Videos in Table) ---
async function loadReviews() {
    const tableBody = document.getElementById('adminTableBody');
    const loadingReviews = document.getElementById('loadingReviews');
    tableBody.innerHTML = "";
    
    // Get reviews sorted by newest
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    loadingReviews.style.display = 'none';

    if (snapshot.empty) {
        tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No reviews found.</td></tr>";
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        
        // Logic to show Image or Video Thumbnail
        let mediaDisplay = "No Media";
        if (data.mediaURL) {
            if (data.mediaType === 'video') {
                // Video Thumbnail (Click to play in new tab)
                mediaDisplay = `
                    <div style="width: 80px; height: 80px; overflow: hidden; border-radius: 5px; cursor: pointer; border: 1px solid #ccc;">
                        <video src="${data.mediaURL}" style="width: 100%; height: 100%; object-fit: cover;" onclick="window.open('${data.mediaURL}')"></video>
                    </div>`;
            } else {
                // Image Thumbnail (Click to view full)
                mediaDisplay = `
                    <div style="width: 80px; height: 80px; overflow: hidden; border-radius: 5px; cursor: pointer; border: 1px solid #ccc;">
                        <img src="${data.mediaURL}" style="width: 100%; height: 100%; object-fit: cover;" onclick="window.open('${data.mediaURL}')" alt="Review Image">
                    </div>`;
            }
        }

        const row = `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-weight:bold;">${data.name}</td>
                <td style="padding:10px; max-width: 300px;">${data.text}</td>
                <td style="padding:10px;">${mediaDisplay}</td>
                <td style="padding:10px;">
                    <button onclick="deleteItem('reviews', '${doc.id}')" style="background: #ff4757; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 0.9rem;">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}


// --- 7. LOAD DYNAMIC GALLERY (User Side) ---
const galleryContainer = document.getElementById('dynamicGallery');

async function loadUserGallery() {
    if (!galleryContainer) return;

    // Get gallery items sorted by newest
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(20)); 

    try {
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            galleryContainer.innerHTML = "<p style='text-align:center; width:100%;'>No photos added yet.</p>";
            return;
        }

        galleryContainer.innerHTML = ""; // Clear loading text

        snapshot.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = 'gallery-card';

            if (data.mediaType === 'video') {
                card.innerHTML = `<video src="${data.mediaURL}" controls style="width:100%; height:100%; object-fit:cover;"></video>`;
            } else {
                card.innerHTML = `<img src="${data.mediaURL}" alt="Party Event" onclick="window.open('${data.mediaURL}')" style="cursor:pointer;">`;
            }

            galleryContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Gallery Error:", error);
    }
}

// Call this function
loadUserGallery();