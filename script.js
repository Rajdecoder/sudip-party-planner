// Import Firebase SDKs (Directly from Google CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { addDoc, collection, getFirestore, onSnapshot, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
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

// --- COMPRESSION LOGIC (Images Only) ---
async function compressImage(file) {
    // If it's a video, return original (we don't compress video in browser easily)
    if (file.type.startsWith('video/')) return file;
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resize to max 800px width
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Compress to JPEG with 0.7 quality
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            }
        }
    });
}

// --- UPLOAD & SAVE REVIEW ---
const reviewForm = document.getElementById('reviewForm');
const submitBtn = document.getElementById('submitBtn');
const uploadStatus = document.getElementById('uploadStatus');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('reviewerName').value;
    const text = document.getElementById('reviewerText').value;
    const fileInput = document.getElementById('reviewMedia');
    const file = fileInput.files[0];

    // Disable button to prevent double submit
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    let downloadURL = null;
    let fileType = null;

    try {
        if (file) {
            // Check file size (Limit to 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert("File too large! Please upload under 10MB.");
                submitBtn.disabled = false;
                submitBtn.innerText = "Post Review";
                return;
            }

            uploadStatus.style.display = 'block';
            statusText.innerText = "Compressing...";

            // 1. Compress Image
            const compressedFile = await compressImage(file);
            fileType = file.type.startsWith('video/') ? 'video' : 'image';

            // 2. Upload to Firebase Storage
            statusText.innerText = "Uploading Media...";
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

        // 3. Save Data to Firestore Database
        statusText.innerText = "Saving Review...";
        await addDoc(collection(db, "reviews"), {
            name: name,
            text: text,
            mediaURL: downloadURL,
            mediaType: fileType,
            createdAt: serverTimestamp() // Auto server time
        });

        alert("Review Posted Successfully!");
        reviewForm.reset();
        uploadStatus.style.display = 'none';
        progressBar.style.width = '0%';

    } catch (error) {
        console.error("Error adding review: ", error);
        alert("Error posting review. Check console for details.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Post Review";
    }
});

// --- LOAD REVIEWS (Real-time) ---
const reviewsContainer = document.getElementById('reviewsContainer');

// Query database ordered by newest first
const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
    reviewsContainer.innerHTML = ""; // Clear list
    
    snapshot.forEach((doc) => {
        const review = doc.data();
        
        let mediaHTML = "";
        if (review.mediaURL) {
            if (review.mediaType === 'video') {
                mediaHTML = `<video controls src="${review.mediaURL}" style="width:100%; border-radius:10px; margin-top:10px; max-height:250px;"></video>`;
            } else {
                mediaHTML = `<img src="${review.mediaURL}" alt="Review Image" style="width:100%; border-radius:10px; margin-top:10px; max-height:250px; object-fit:cover;">`;
            }
        }

        const card = document.createElement("div");
        card.className = "review-card";
        card.innerHTML = `
            <div class="review-header">
                <div style="width:40px; height:40px; background:#ff4757; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-right:10px;">
                    ${review.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 style="margin:0;">${review.name}</h4>
                    <small style="color:#777;">Verified Customer</small>
                </div>
            </div>
            <p class="review-text">"${review.text}"</p>
            ${mediaHTML}
        `;
        reviewsContainer.appendChild(card);
    });
});